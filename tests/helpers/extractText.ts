import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

// Use pdfjs legacy CJS build — designed for Node.js environments.
// When no Worker API is available (Node.js), pdfjs falls back to same-thread processing.
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfjsLib: any = require('pdfjs-dist/legacy/build/pdf.js')
pdfjsLib.GlobalWorkerOptions.workerSrc = '' // triggers FakeWorker in Node.js

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  const loadingTask = pdfjsLib.getDocument({ data, disableFontFace: true })
  const pdf = await loadingTask.promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(
      (content.items as Array<{ str: string }>).map((item) => item.str).join(' '),
    )
  }
  return pages.join('\n')
}
