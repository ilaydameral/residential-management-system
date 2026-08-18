namespace ResidentialManagement.Api.Services;

public class ImportParseResult
{
    public List<string> Headers { get; set; } = new();
    public List<ImportParsedRow> Rows { get; set; } = new();
}

public class ImportParsedRow
{
    public int RowNumber { get; set; }
    public Dictionary<string, string> Values { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public interface IImportFileParser
{
    ImportParseResult ParseFile(Stream fileStream, string extension);
}
