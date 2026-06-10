import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { imageUrl, fileType } = await request.json()

  if (!imageUrl) {
    return NextResponse.json({ error: 'No image URL provided' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI extraction not configured' }, { status: 503 })
  }

  try {
    // Fetch the image and convert to base64
    const imageRes = await fetch(imageUrl)
    const imageBuffer = await imageRes.arrayBuffer()
    const base64 = Buffer.from(imageBuffer).toString('base64')
    const mediaType = (fileType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Analyze this receipt image carefully. Extract:
1. All line items with their amounts (in RM or the currency shown)
2. Any subtotal, tax, service charge
3. The grand total / total amount

Respond ONLY with valid JSON in this exact format:
{
  "items": [
    { "description": "item name", "amount": 12.50 }
  ],
  "subtotal": 100.00,
  "tax": 6.00,
  "service_charge": 10.00,
  "total": 116.00,
  "currency": "RM",
  "date": "2024-01-15",
  "vendor": "Restaurant/Shop name"
}
If a field is not found, use null. Amounts must be numbers, not strings.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse receipt data' }, { status: 422 })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data: extracted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Extraction failed' }, { status: 500 })
  }
}
