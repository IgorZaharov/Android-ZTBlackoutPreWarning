import Foundation

/// TestFlight diagnostics of the widget buttons (owner, 2026-11-15: a tap on the bell or refresh opened the
/// app and the button did nothing, also with the intents in the extension only). The intents, the widget
/// timeline and the app write one short line each to the App Group; Settings shows the last lines in
/// TestFlight builds only, so a tester can tell whether `perform()` ran at all and in which process.
public enum WidgetDiag {
    private static let prefs = Prefs("zt_widget_diag_v1")
    private static let maxLines = 14

    /// "app" or "widget": the process that wrote the line.
    private static var process: String {
        Bundle.main.bundleURL.pathExtension == "appex" ? "widget" : "app"
    }

    public static func log(_ event: String) {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm:ss"
        var lines = prefs.object("lines") as? [String] ?? []
        let line = "\(f.string(from: Date())) \(process): \(event)"
        // the timeline is asked for often: one such line per minute is enough ("HH:mm:ss " is 9 characters)
        if event.hasPrefix("timeline") || event == "active",
           let last = lines.last, last.prefix(5) == line.prefix(5), last.dropFirst(9) == line.dropFirst(9) { return }
        lines.append(line)
        prefs.set("lines", Array(lines.suffix(maxLines)))
    }

    public static func lines() -> [String] { prefs.object("lines") as? [String] ?? [] }

    public static func clear() { prefs.remove("lines") }

    /// A TestFlight install (sandbox receipt); never true for an App Store install.
    public static var isTestFlight: Bool {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }
}
