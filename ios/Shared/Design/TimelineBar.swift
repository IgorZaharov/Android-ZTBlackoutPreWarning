import SwiftUI

/// One half-hour cell of the drum, reduced to what is drawn (spec/UI_DRUM.md section 1).
public struct DrumCell: Equatable, Sendable {
    public var planned: Bool
    public var emergency: Bool

    public init(planned: Bool, emergency: Bool) {
        self.planned = planned
        self.emergency = emergency
    }
}

/// Pure geometry and cell mapping of the drum, shared by the app and the widgets and unit tested.
public enum DrumGeometry {
    /// Light hour separators between the 24 hour boxes; the two half-hours of one hour touch.
    public static let hourGap: CGFloat = 1.5
    public static let cellHeight: CGFloat = 32
    /// Padding of the recessed well around the cell strip (the 2 pt border is drawn inside it).
    public static let wellPadding: CGFloat = 6
    /// Stripe geometry: 3 pt stripe + 3 pt gap measured across the stripe, at 45 degrees.
    public static let stripeWidth: CGFloat = 3
    public static let stripePeriod: CGFloat = 6 * 2.0.squareRoot()

    public static func hourWidth(trackWidth: CGFloat) -> CGFloat { max(0, (trackWidth - hourGap * 23) / 24) }

    /// Left edge of cell `index` (0..<48) inside the strip.
    public static func cellLeft(_ index: Int, trackWidth: CGFloat) -> CGFloat {
        let hourW = hourWidth(trackWidth: trackWidth)
        return CGFloat(index / 2) * (hourW + hourGap) + CGFloat(index % 2) * hourW / 2
    }

    /// Needle centre inside the strip: exact position within the hour box, so the 1.5 pt gaps do not skew it.
    /// Hour clamped 0...23, minute 0...59 (seconds ignored).
    public static func needleX(trackWidth: CGFloat, hour: Int, minute: Int) -> CGFloat {
        let hourW = hourWidth(trackWidth: trackWidth)
        let h = min(23, max(0, hour))
        let m = min(59, max(0, minute))
        return CGFloat(h) * (hourW + hourGap) + CGFloat(m) / 60 * hourW
    }

    /// 48 cells from `slots` (48 half-hours, or 24 legacy hourly slots used twice); nil otherwise.
    /// `planned` and `emergency` are separate so a planned outage under an emergency shows both.
    public static func cells(_ slots: [BlackoutSlot]) -> [DrumCell]? {
        OutageRowFormat.cells(slots)?.map { s in
            let off = s.status == .POWER_OFF
            return DrumCell(planned: off && (s.isPlanned || !s.isEmergency), emergency: off && s.isEmergency)
        }
    }

    /// The tick hours under the drum: every 2 h, every 4 h at large Dynamic Type (labels cannot overlap).
    public static func tickHours(every step: Int) -> [Int] { Array(stride(from: 0, through: 24, by: step)) }
}

/// Draws the 48 cells into a canvas (the drum strip of the app and the widgets).
public enum DrumRenderer {
    public static func drawCells(_ gc: GraphicsContext, size: CGSize, cells: [DrumCell], unclearBase: Bool) {
        let w = size.width
        let h = size.height
        gc.fill(Path(CGRect(origin: .zero, size: size)), with: .color(ZtDrumColors.hourSeparator))
        let halfW = DrumGeometry.hourWidth(trackWidth: w) / 2
        let mid = h / 2
        let vertical = (CGPoint(x: 0, y: 0), CGPoint(x: 0, y: h))
        for (i, cell) in cells.prefix(48).enumerated() {
            let left = DrumGeometry.cellLeft(i, trackWidth: w)
            // The two cells of one hour touch; +0.5 pt on the first hides the seam
            let width = halfW + (i % 2 == 0 ? 0.5 : 0)
            let colors = cell.planned ? ZtDrumColors.off : (unclearBase ? ZtDrumColors.unclear : ZtDrumColors.on)
            gc.fill(
                Path(CGRect(x: left, y: 0, width: width, height: h)),
                with: .linearGradient(Gradient(colors: colors), startPoint: vertical.0, endPoint: vertical.1)
            )
            if cell.emergency {
                // An emergency takes only the bottom half: the top half keeps the planned state behind it
                let rect = CGRect(x: left, y: mid, width: width, height: h - mid)
                gc.fill(
                    Path(rect),
                    with: .linearGradient(Gradient(colors: ZtDrumColors.emergency), startPoint: CGPoint(x: 0, y: mid), endPoint: CGPoint(x: 0, y: h))
                )
                drawStripes(gc, in: rect)
            }
        }
    }

    /// 45 degree stripes inside `rect`, anchored to the strip's x origin (stripe starts are multiples of the
    /// period) so adjacent emergency cells continue each other's stripes.
    static func drawStripes(_ gc: GraphicsContext, in rect: CGRect) {
        var g = gc
        g.clip(to: Path(rect))
        let band = rect.height
        let period = DrumGeometry.stripePeriod
        var x = (floor((rect.minX - band) / period)) * period
        var path = Path()
        while x < rect.maxX {
            path.move(to: CGPoint(x: x, y: rect.maxY))
            path.addLine(to: CGPoint(x: x + band, y: rect.minY))
            x += period
        }
        g.stroke(path, with: .color(ZtDrumColors.emergencyStripeDark), lineWidth: DrumGeometry.stripeWidth)
    }
}

/// The 24-hour "analog meter" drum (Android `TimelineBar`). Planned and repair outages are crimson,
/// emergency outages amber with 45 degree stripes in the bottom half, emergency over planned is crimson
/// on top and striped amber below. `unclearBase` paints cells without an outage grey (the day's table
/// is not known) while known outages are still drawn. The whole drum is one VoiceOver element described
/// by `OutageRowFormat.drumSummary`.
public struct TimelineBar: View {
    private let cells: [DrumCell]?
    private let summary: String
    private let currentHour: Int
    private let currentMinute: Int
    private let showNeedle: Bool
    private let lang: String
    private let unclearBase: Bool
    /// Fixed tick step in hours (widgets); nil = every 2 h, every 4 h at accessibility text sizes.
    private let tickEvery: Int?

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    public init(
        slots: [BlackoutSlot],
        currentHour: Int = 12,
        currentMinute: Int = 0,
        showNeedle: Bool = true,
        lang: String = "uk",
        unclearBase: Bool = false,
        tickEvery: Int? = nil
    ) {
        self.cells = DrumGeometry.cells(slots)
        self.summary = OutageRowFormat.drumSummary(lang, slots, unclearBase: unclearBase)
        self.currentHour = currentHour
        self.currentMinute = currentMinute
        self.showNeedle = showNeedle
        self.lang = lang
        self.unclearBase = unclearBase
        self.tickEvery = tickEvery
    }

    public var body: some View {
        VStack(spacing: 0) {
            well
                .padding(.vertical, 4)
                .overlay { if showNeedle { needle } }
            Color.clear.frame(height: 2)
            ticks
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .background {
            RoundedRectangle(cornerRadius: 16)
                .fill(LinearGradient(colors: ZtDrumColors.faceplate, startPoint: .top, endPoint: .bottom))
        }
        .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(ZtDrumColors.faceplateBorder, lineWidth: 2) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(summary))
    }

    /// Recessed dark-grey counter slot around the cells.
    private var well: some View {
        Group {
            if let cells {
                Canvas { gc, size in
                    DrumRenderer.drawCells(gc, size: size, cells: cells, unclearBase: unclearBase)
                }
                .frame(maxWidth: .infinity)
                .frame(height: DrumGeometry.cellHeight)
                .clipShape(RoundedRectangle(cornerRadius: 2))
            } else {
                // Nothing is known for this queue: one grey block with "Графіки не діють"
                Text(AppStrings.outagesUnclear(lang))
                    .ztText(ZtType.label.weight(.heavy))
                    .foregroundStyle(Color.white)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .frame(maxWidth: .infinity, minHeight: DrumGeometry.cellHeight)
                    .background {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(LinearGradient(colors: ZtDrumColors.unclear, startPoint: .top, endPoint: .bottom))
                    }
            }
        }
        .padding(DrumGeometry.wellPadding)
        .background { RoundedRectangle(cornerRadius: 8).fill(ZtDrumColors.well) }
        .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(ZtDrumColors.wellBorder, lineWidth: 2) }
    }

    /// Black needle with a light halo, sticking out 4 pt above and below the slot.
    private var needle: some View {
        Canvas { gc, size in
            let inset = DrumGeometry.wellPadding
            let x = inset + DrumGeometry.needleX(trackWidth: size.width - inset * 2, hour: currentHour, minute: currentMinute)
            let halo: CGFloat = 4.5
            let bar: CGFloat = 3
            gc.fill(
                Path(roundedRect: CGRect(x: x - halo / 2, y: 0, width: halo, height: size.height), cornerRadius: halo / 2),
                with: .color(ZtDrumColors.needleHalo)
            )
            gc.fill(
                Path(roundedRect: CGRect(x: x - bar / 2, y: 0, width: bar, height: size.height), cornerRadius: bar / 2),
                with: .color(ZtDrumColors.needle)
            )
        }
        .allowsHitTesting(false)
    }

    /// Stamped tick marks and two-digit hours, laid out edge to edge.
    private var ticks: some View {
        let step = tickEvery ?? (dynamicTypeSize >= .xxxLarge ? 4 : 2)
        let hours = DrumGeometry.tickHours(every: step)
        return HStack(alignment: .top, spacing: 0) {
            ForEach(hours, id: \.self) { hour in
                if hour != hours.first { Spacer(minLength: 0) }
                VStack(spacing: 1) {
                    Rectangle().fill(ZtDrumColors.tick).frame(width: 1.5, height: 5)
                    Text(verbatim: hour < 10 ? "0\(hour)" : "\(hour)")
                        .ztText(ZtType.overline.monospaced().tracking(0))
                        .foregroundStyle(ZtDrumColors.tick)
                        .lineLimit(1)
                        .fixedSize()
                }
            }
        }
        .padding(.horizontal, 2)
    }
}
