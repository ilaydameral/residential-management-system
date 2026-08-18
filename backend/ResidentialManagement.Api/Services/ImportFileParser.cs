using System.Text;
using MiniExcelLibs;
using ResidentialManagement.Api.Exceptions;

namespace ResidentialManagement.Api.Services;

public class ImportFileParser : IImportFileParser
{
    public ImportParseResult ParseFile(Stream fileStream, string extension)
    {
        if (fileStream is null || fileStream.Length == 0)
        {
            throw new BadRequestException("Ayrıştırılacak dosya boş.");
        }

        var normalizedExt = extension.Trim().ToLowerInvariant();
        if (normalizedExt == ".csv")
        {
            return ParseCsv(fileStream);
        }
        
        if (normalizedExt == ".xlsx")
        {
            return ParseXlsx(fileStream);
        }

        throw new BadRequestException("Desteklenmeyen dosya uzantısı. Yalnızca .csv ve .xlsx desteklenir.");
    }

    private static ImportParseResult ParseCsv(Stream stream)
    {
        stream.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var csvRows = ReadCsvLines(reader);

        if (csvRows.Count == 0)
        {
            return new ImportParseResult();
        }

        var headers = csvRows[0].Select(h => h.Trim().Trim('\uFEFF')).ToList();
        var result = new ImportParseResult
        {
            Headers = headers
        };

        for (int i = 1; i < csvRows.Count; i++)
        {
            var line = csvRows[i];
            var rowDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            for (int h = 0; h < headers.Count; h++)
            {
                var headerName = headers[h];
                if (string.IsNullOrWhiteSpace(headerName)) continue;

                var val = h < line.Count ? line[h].Trim() : string.Empty;
                rowDict[headerName] = val;
            }

            result.Rows.Add(new ImportParsedRow
            {
                RowNumber = i + 1, // 1-indexed row number (row 1 is header)
                Values = rowDict
            });
        }

        return result;
    }

    private static List<List<string>> ReadCsvLines(TextReader reader)
    {
        var rows = new List<List<string>>();
        var currentField = new StringBuilder();
        var currentRow = new List<string>();
        bool inQuotes = false;

        while (reader.Peek() >= 0)
        {
            char c = (char)reader.Read();
            if (c == '"')
            {
                if (inQuotes && reader.Peek() == '"')
                {
                    reader.Read(); // Consume escaped double quote ""
                    currentField.Append('"');
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                currentRow.Add(currentField.ToString());
                currentField.Clear();
            }
            else if ((c == '\r' || c == '\n') && !inQuotes)
            {
                if (c == '\r' && reader.Peek() == '\n')
                {
                    reader.Read(); // Consume \n
                }
                currentRow.Add(currentField.ToString());
                currentField.Clear();

                if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)) || currentRow.Count > 1)
                {
                    rows.Add(currentRow);
                }
                currentRow = new List<string>();
            }
            else
            {
                currentField.Append(c);
            }
        }

        if (currentField.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentField.ToString());
            if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)))
            {
                rows.Add(currentRow);
            }
        }

        return rows;
    }

    private static ImportParseResult ParseXlsx(Stream stream)
    {
        stream.Seek(0, SeekOrigin.Begin);
        var rows = stream.Query(useHeaderRow: true).ToList();

        if (rows.Count == 0)
        {
            return new ImportParseResult();
        }

        var firstRow = rows[0] as IDictionary<string, object>;
        if (firstRow is null)
        {
            return new ImportParseResult();
        }

        var headers = firstRow.Keys.Select(k => k.Trim()).ToList();
        var result = new ImportParseResult
        {
            Headers = headers
        };

        int rowNum = 2; // Row 1 is header
        foreach (var item in rows)
        {
            if (item is IDictionary<string, object> dict)
            {
                var rowDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kvp in dict)
                {
                    var valStr = kvp.Value?.ToString()?.Trim() ?? string.Empty;
                    rowDict[kvp.Key.Trim()] = valStr;
                }

                result.Rows.Add(new ImportParsedRow
                {
                    RowNumber = rowNum++,
                    Values = rowDict
                });
            }
        }

        return result;
    }
}
