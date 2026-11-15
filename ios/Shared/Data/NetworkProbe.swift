import Foundation
import Network

/// Asks the operating system whether the device has working internet (mirror of android
/// data/net/NetworkProbe.kt). Uses the system's own verdict (`NWPath.status == .satisfied`), so no
/// third-party host is contacted and the privacy policy stays accurate (spec/SITE_STATE.md section 4).
///
/// One monitor runs from the first use; it is read after a request failed. Until the first path
/// update arrives the answer is "online", so the app never claims "no internet" without evidence.
public enum NetworkProbe {
    private static let lock = NSLock()
    private static var lastStatus: NWPath.Status?
    private static let monitor: NWPathMonitor = {
        let m = NWPathMonitor()
        m.pathUpdateHandler = { path in
            NetworkProbe.lock.lock()
            NetworkProbe.lastStatus = path.status
            NetworkProbe.lock.unlock()
        }
        m.start(queue: DispatchQueue(label: "ua.blackout.prewarning.network-probe"))
        return m
    }()

    /// Starts the monitor early (app launch, background task start) so a verdict is ready when needed.
    public static func start() { _ = monitor }

    public static func isValidated() -> Bool {
        start()
        lock.lock(); defer { lock.unlock() }
        guard let status = lastStatus else { return true }
        return status == .satisfied
    }
}
