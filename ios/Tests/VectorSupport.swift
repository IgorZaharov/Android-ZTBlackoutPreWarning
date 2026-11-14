import XCTest
@testable import ZTPreBlackout

/// Loads the shared golden vectors. `spec/vectors` is a folder reference of the test target
/// (ios/project.yml), so iOS reads the same bytes as the Kotlin and TypeScript runners.
typealias J = [String: Any]

enum Vectors {
    static func load(_ name: String, file: StaticString = #filePath, line: UInt = #line) throws -> J {
        let bundle = Bundle(for: BundleToken.self)
        guard let dir = bundle.url(forResource: "vectors", withExtension: nil) else {
            XCTFail("spec/vectors is not in the test bundle", file: file, line: line)
            throw VectorError.missing(name)
        }
        let data = try Data(contentsOf: dir.appendingPathComponent(name))
        guard let obj = try JSONSerialization.jsonObject(with: data) as? J else { throw VectorError.notAnObject(name) }
        return obj
    }

    enum VectorError: Error { case missing(String), notAnObject(String) }

    private final class BundleToken {}
}

extension Dictionary where Key == String, Value == Any {
    func obj(_ k: String) -> J? { self[k] as? J }
    func objs(_ k: String) -> [J] { (self[k] as? [Any] ?? []).compactMap { $0 as? J } }
    func array(_ k: String) -> [Any]? { self[k] as? [Any] }
    func strings(_ k: String) -> [String]? { (self[k] as? [Any])?.compactMap { $0 as? String } }
    /// String value, nil when absent or JSON null (Kotlin `optStr`).
    func str(_ k: String) -> String? { self[k] as? String }
    func bool(_ k: String) -> Bool? { (self[k] as? NSNumber)?.boolValue }
    func int(_ k: String) -> Int? { (self[k] as? NSNumber)?.intValue }
    func has(_ k: String) -> Bool { self[k] != nil }
}

func ldt(_ s: String?, file: StaticString = #filePath, line: UInt = #line) -> LocalDateTime? {
    guard let s else { return nil }
    let v = LocalDateTime(iso: s)
    if v == nil { XCTFail("bad LocalDateTime in vector: \(s)", file: file, line: line) }
    return v
}

func ld(_ s: String) -> LocalDate { LocalDate(iso: s)! }

/// Canonical JSON text of a JSON-shaped value (sorted keys), for whole-store comparisons.
func canonicalJSON(_ v: Any) -> String {
    let data = try! JSONSerialization.data(withJSONObject: v, options: [.sortedKeys, .fragmentsAllowed])
    return String(decoding: data, as: UTF8.self)
}
