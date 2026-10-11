import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)
const tableName = process.env.TABLE_NAME!

interface SyncResponse {
  progress: unknown
  history: unknown
  favorites: unknown
}

export const handler = async (event: {
  requestContext: { authorizer: { jwt: { claims: { sub: string } } } }
}): Promise<{ statusCode: number; body: string; headers: Record<string, string> }> => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub
  if (!userId) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: '' }

  let result
  try {
    result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `SYNC#${userId}` },
        ConsistentRead: true,
      }),
    )
  } catch (err) {
    console.error('sync pull failed', { userId, error: err instanceof Error ? err.message : err })
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    }
  }

  const response: SyncResponse = { progress: null, history: null, favorites: null }
  for (const item of result.Items ?? []) {
    if (item.SK === 'PROGRESS') response.progress = item.data
    if (item.SK === 'HISTORY') response.history = item.data
    if (item.SK === 'FAVORITES') response.favorites = item.data
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(response),
  }
}