import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { validateFavoritesExportFile, validateHistoryExportFile, validateProgressExportFile } from '../../utils/syncPayloadValidator'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)
const tableName = process.env.TABLE_NAME!

interface SyncPayload {
  progress: unknown
  history: unknown
  favorites: unknown
}

interface PutTransactItem {
  Put: { TableName: string; Item: Record<string, unknown> }
}

interface DeleteTransactItem {
  Delete: { TableName: string; Key: Record<string, string> }
}

const now = () => new Date().toISOString()

const MAX_ITEM_SIZE_BYTES = 190 * 1024

function itemExceedsMaxSize(item: Record<string, unknown>): boolean {
  return Buffer.byteLength(JSON.stringify(item), 'utf8') > MAX_ITEM_SIZE_BYTES
}

function recordCommand(
  kind: 'PROGRESS' | 'HISTORY' | 'FAVORITES',
  payload: unknown,
  pk: string,
  timestamp: string,
): PutTransactItem | DeleteTransactItem {
  const key = { PK: pk, SK: kind }
  if (payload === null) {
    return { Delete: { TableName: tableName, Key: key } }
  }
  return {
    Put: {
      TableName: tableName,
      Item: { ...key, data: payload, updatedAt: timestamp },
    },
  }
}

export const handler = async (event: {
  requestContext: { authorizer: { jwt: { claims: { sub: string } } } }
  body: string | null
}): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub
  if (!userId) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: '' }

  let payload: SyncPayload
  try {
    const parsed: unknown = event.body ? JSON.parse(event.body) : {}
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid request body' }),
      }
    }
    payload = parsed as SyncPayload
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid JSON body' }),
    }
  }

  if ('progress' in payload && payload.progress !== null && validateProgressExportFile(payload.progress).length > 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid progress document' }),
    }
  }
  if ('history' in payload && payload.history !== null && validateHistoryExportFile(payload.history).length > 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid history document' }),
    }
  }
  if ('favorites' in payload && payload.favorites !== null && validateFavoritesExportFile(payload.favorites).length > 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid favorites document' }),
    }
  }

  const pk = `SYNC#${userId}`
  const timestamp = now()

  const commands: (PutTransactItem | DeleteTransactItem)[] = []
  if ('progress' in payload) {
    commands.push(recordCommand('PROGRESS', payload.progress, pk, timestamp))
  }
  if ('history' in payload) {
    commands.push(recordCommand('HISTORY', payload.history, pk, timestamp))
  }
  if ('favorites' in payload) {
    commands.push(recordCommand('FAVORITES', payload.favorites, pk, timestamp))
  }

  for (const command of commands) {
    if ('Put' in command && itemExceedsMaxSize(command.Put.Item)) {
      return {
        statusCode: 413,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Payload too large' }),
      }
    }
  }

  if (commands.length > 0) {
    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: commands }))
    } catch (err) {
      console.error('sync push failed', { userId, error: err instanceof Error ? err.message : err })
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error' }),
      }
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }
}