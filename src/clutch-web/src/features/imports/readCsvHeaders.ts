import Papa from 'papaparse'

const maximumHeaderCount = 100
const maximumHeaderLength = 200

export function readCsvHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      preview: 1,
      dynamicTyping: false,
      skipEmptyLines: false,
      complete: (result) => {
        const headers = result.data[0]
        if (
          result.errors.length > 0
          || !Array.isArray(headers)
          || headers.length === 0
          || headers.length > maximumHeaderCount
          || headers.some(
            (header) =>
              header.trim().length === 0 || header.length > maximumHeaderLength,
          )
        ) {
          reject(new Error('The selected CSV header is invalid.'))
          return
        }

        resolve(headers.map((header) => header.trim()))
      },
      error: () => reject(new Error('The selected CSV header could not be read.')),
    })
  })
}
