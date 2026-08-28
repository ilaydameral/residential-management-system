using System.Text;
using System.IO.Compression;
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
        EnsureColumnLimit(headers.Count);
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
                    EnsureCellLimit(currentField.Length);
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                AddCsvField(currentRow, currentField);
                currentField.Clear();
            }
            else if ((c == '\r' || c == '\n') && !inQuotes)
            {
                if (c == '\r' && reader.Peek() == '\n')
                {
                    reader.Read(); // Consume \n
                }
                AddCsvField(currentRow, currentField);
                currentField.Clear();

                if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)) || currentRow.Count > 1)
                {
                    AddCsvRow(rows, currentRow);
                }
                currentRow = new List<string>();
            }
            else
            {
                currentField.Append(c);
                EnsureCellLimit(currentField.Length);
            }
        }

        if (currentField.Length > 0 || currentRow.Count > 0)
        {
            AddCsvField(currentRow, currentField);
            if (currentRow.Any(f => !string.IsNullOrWhiteSpace(f)))
            {
                AddCsvRow(rows, currentRow);
            }
        }

        return rows;
    }

    private static ImportParseResult ParseXlsx(Stream stream)
    {
        ValidateXlsxArchive(stream);
        stream.Seek(0, SeekOrigin.Begin);
        var rows = stream.Query(useHeaderRow: true)
            .Take(ImportProcessingLimits.MaxRows + 1)
            .ToList();

        if (rows.Count > ImportProcessingLimits.MaxRows)
        {
            throw new BadRequestException($"Dosya en fazla {ImportProcessingLimits.MaxRows:N0} veri satırı içerebilir.");
        }

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
        EnsureColumnLimit(headers.Count);
        var result = new ImportParseResult
        {
            Headers = headers
        };

        int rowNum = 2; // Row 1 is header
        foreach (var item in rows)
        {
            if (item is IDictionary<string, object> dict)
            {
                EnsureColumnLimit(dict.Count);
                var rowDict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kvp in dict)
                {
                    var valStr = kvp.Value?.ToString()?.Trim() ?? string.Empty;
                    EnsureCellLimit(valStr.Length);
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

    private static void ValidateXlsxArchive(Stream stream)
    {
        stream.Seek(0, SeekOrigin.Begin);
        try
        {
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
            if (archive.Entries.Count > ImportProcessingLimits.MaxXlsxArchiveEntries)
            {
                throw new BadRequestException("Excel dosyası güvenli arşiv girdi sınırını aşıyor.");
            }

            long expandedBytes = 0;
            foreach (var entry in archive.Entries)
            {
                if (entry.Length > ImportProcessingLimits.MaxXlsxExpandedBytes - expandedBytes)
                {
                    throw new BadRequestException("Excel dosyasının açılmış içeriği güvenli boyut sınırını aşıyor.");
                }

                expandedBytes += entry.Length;
            }
        }
        catch (InvalidDataException)
        {
            throw new BadRequestException("Excel dosyası geçerli veya güvenli bir XLSX arşivi değil.");
        }
        finally
        {
            stream.Seek(0, SeekOrigin.Begin);
        }
    }

    private static void AddCsvField(List<string> row, StringBuilder field)
    {
        EnsureColumnLimit(row.Count + 1);
        EnsureCellLimit(field.Length);
        row.Add(field.ToString());
    }

    private static void AddCsvRow(List<List<string>> rows, List<string> row)
    {
        // The first stored row is the header and is not part of the data-row allowance.
        if (rows.Count >= ImportProcessingLimits.MaxRows + 1)
        {
            throw new BadRequestException($"Dosya en fazla {ImportProcessingLimits.MaxRows:N0} veri satırı içerebilir.");
        }

        rows.Add(row);
    }

    private static void EnsureColumnLimit(int columnCount)
    {
        if (columnCount > ImportProcessingLimits.MaxColumns)
        {
            throw new BadRequestException($"Dosya en fazla {ImportProcessingLimits.MaxColumns} sütun içerebilir.");
        }
    }

    private static void EnsureCellLimit(int cellLength)
    {
        if (cellLength > ImportProcessingLimits.MaxCellLength)
        {
            throw new BadRequestException($"Bir hücre en fazla {ImportProcessingLimits.MaxCellLength:N0} karakter içerebilir.");
        }
    }
}
