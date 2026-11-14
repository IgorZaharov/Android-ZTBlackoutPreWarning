import Foundation

/// Storage shared by the app and the widget extension through the App Group
/// `group.ua.blackout.prewarning` (spec/PERSISTENCE.md).
///
/// - Small key/value stores (Android SharedPreferences files) live in the App Group UserDefaults suite.
///   Android keeps each store in its own file; here every store except the user settings prefixes its
///   keys with its store name, so `site_state` of the outage store never collides with a settings key.
///   The user settings keep the bare field names of spec/PERSISTENCE.md section 1.
/// - Large data (address index, ledgers) are versioned JSON files in the container
///   (spec/PERSISTENCE.md section 6), written atomically and excluded from device backups.
public enum AppGroup {
    public static let id = "group.ua.blackout.prewarning"

    /// The shared suite; falls back to the app's own defaults when the entitlement is missing
    /// (unsigned simulator builds in CI), which keeps the app working without widget sharing.
    public static let suite: UserDefaults = UserDefaults(suiteName: id) ?? .standard

    /// Container directory for JSON files; the app's Application Support folder without the entitlement.
    public static let containerURL: URL = {
        if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) {
            return url
        }
        let fallback = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: fallback, withIntermediateDirectories: true)
        return fallback
    }()

    public static func fileURL(_ name: String) -> URL { containerURL.appendingPathComponent(name) }

    /// Reads a JSON file as Foundation objects; nil when absent or unreadable.
    public static func readJSON(_ name: String) -> Any? {
        guard let data = try? Data(contentsOf: fileURL(name)) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    /// Writes a JSON file atomically, readable by background tasks after the first unlock, and not
    /// backed up (caches and outage state are rebuilt from the network, spec/PERSISTENCE.md section 5).
    @discardableResult
    public static func writeJSON(_ name: String, _ object: Any) -> Bool {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object) else { return false }
        var url = fileURL(name)
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try url.setResourceValues(values)
            return true
        } catch {
            return false
        }
    }

    public static func removeFile(_ name: String) {
        try? FileManager.default.removeItem(at: fileURL(name))
    }
}

/// One logical key/value store (an Android SharedPreferences file) inside the shared suite.
public struct Prefs {
    public let name: String
    private let prefix: String
    private let defaults: UserDefaults

    /// `bareKeys` is true only for the user settings, whose keys keep their plain field names.
    public init(_ name: String, bareKeys: Bool = false, defaults: UserDefaults = AppGroup.suite) {
        self.name = name
        self.prefix = bareKeys ? "" : name + "."
        self.defaults = defaults
    }

    private func k(_ key: String) -> String { prefix + key }

    public func contains(_ key: String) -> Bool { defaults.object(forKey: k(key)) != nil }
    public func object(_ key: String) -> Any? { defaults.object(forKey: k(key)) }

    public func string(_ key: String) -> String? { defaults.object(forKey: k(key)) as? String }
    public func string(_ key: String, _ def: String) -> String {
        guard let raw = defaults.object(forKey: k(key)) else { return def }
        if let s = raw as? String { return s }
        return "\(raw)"
    }

    /// Lenient like SettingsRepository.readSafe*: numbers stored as strings or of another width still read.
    public func int(_ key: String, _ def: Int) -> Int {
        guard let raw = defaults.object(forKey: k(key)) else { return def }
        if let n = raw as? NSNumber { return n.intValue }
        if let s = raw as? String, let v = Int(s.trimmingCharacters(in: .whitespaces)) { return v }
        return def
    }

    public func int64(_ key: String, _ def: Int64) -> Int64 {
        guard let raw = defaults.object(forKey: k(key)) else { return def }
        if let n = raw as? NSNumber { return n.int64Value }
        if let s = raw as? String, let v = Int64(s.trimmingCharacters(in: .whitespaces)) { return v }
        return def
    }

    public func bool(_ key: String, _ def: Bool) -> Bool {
        guard let raw = defaults.object(forKey: k(key)) else { return def }
        if let n = raw as? NSNumber { return n.boolValue }
        if let s = raw as? String {
            switch s.lowercased() {
            case "true": return true
            case "false": return false
            default: return def
            }
        }
        return def
    }

    public func set(_ key: String, _ value: Any?) {
        if let value { defaults.set(value, forKey: k(key)) } else { defaults.removeObject(forKey: k(key)) }
    }

    public func remove(_ key: String) { defaults.removeObject(forKey: k(key)) }

    /// Every key of this store (without the prefix).
    public func keys() -> [String] {
        let all = defaults.dictionaryRepresentation().keys
        if prefix.isEmpty { return Array(all) }
        return all.filter { $0.hasPrefix(prefix) }.map { String($0.dropFirst(prefix.count)) }
    }

    /// Removes every key of a prefixed store (Android `prefs.edit().clear()`). Not allowed on the bare settings store.
    public func clear() {
        precondition(!prefix.isEmpty, "clear() on the bare settings store would wipe the whole suite")
        for key in keys() { remove(key) }
    }
}
