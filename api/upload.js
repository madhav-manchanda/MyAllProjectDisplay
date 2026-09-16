import { handleUpload } from '@vercel/blob/client'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = await request.json()
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()

    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN is missing from this Vercel deployment.')
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload = {}
        try {
          payload = JSON.parse(clientPayload || '{}')
        } catch {
          throw new Error('Invalid upload payload')
        }

        const configured = (process.env.ADMIN_UPLOAD_KEY || '').trim()
        const supplied = (payload.adminKey || '').trim()

        if (!configured || !supplied || configured !== supplied) {
          throw new Error('Unauthorized')
        }

        return {
          allowedContentTypes: [
            'application/vnd.android.package-archive',
            'application/octet-stream',
          ],
          addRandomSuffix: true,
          access: 'private',
          maximumSizeInBytes: 1024 * 1024 * 1024,
        }
      },
      onUploadCompleted: async () => {},
    })

    return response.status(200).json(jsonResponse)
  } catch (error) {
    console.error('Blob client-token error:', error)
    return response.status(400).json({
      error: error?.message || 'Failed to generate upload token',
    })
  }
}
