package ua.blackout.prewarning.ui.screens

import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.RectF
import android.graphics.Typeface
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.*
import kotlin.random.Random

enum class RouletteScreenMode {
    START,
    SHOP,
    PLAYING,
    FADING_TO_BLACK,
    GAME_OVER
}

enum class TicketRevealOutcome {
    NONE,
    BEIGE,
    X2,
    GOLDEN,
    RED
}

enum class TicketVisualVariant {
    PRISTINE,
    WRINKLED,
    DEEP_WRINKLED,
    CRUMPLED_SCRATCHED,
    CUP_STAIN,
    STAIN_CORNER,
    WATER_STAINS,
    HEAVY_WEAR,
    FADED
}

enum class RouletteUpgradeId(val key: String) {
    X2_TICKET_1("x2_ticket_1"),
    X2_TICKET_2("x2_ticket_2"),
    X2_TICKET_3("x2_ticket_3"),
    FRIEND_ZTOE("friend_ztoe"),
    SECOND_CHANCE("second_chance"),
    FERN_FLOWER("fern_flower"),
    BLACK_CAT("black_cat"),
    NOCTURNAL_CREATURE("nocturnal_creature"),
    DEPOSIT_POWER_POINTS("deposit_power_points"),
    DAILY_STREAK("daily_streak"),
    PERSEVERANCE("perseverance");

    companion object {
        fun fromKey(key: String): RouletteUpgradeId? = values().find { it.key == key }
    }
}

data class RouletteUpgradeDef(
    val id: RouletteUpgradeId,
    val cost: Int,
    val nameUk: String,
    val nameEn: String,
    val descriptionUk: String,
    val descriptionEn: String,
    val hideDescription: Boolean = false,
    val isToggleable: Boolean = false,
    val isRepeatable: Boolean = false,
    val requiredMilestone: Int = 0
) {
    fun formatButtonLabel(lang: String, isPurchased: Boolean = false, depositCount: Int = 0): String {
        if (id == RouletteUpgradeId.DEPOSIT_POWER_POINTS) {
            val baseLabel = if (lang == "en") "Deposit Power Points (Cost: 100)" else "Депозит Потужність+ (Ціна: 100)"
            val sanitizedCount = depositCount.coerceAtLeast(0)
            return if (sanitizedCount > 0) {
                val dailyIncome = sanitizedCount * 10
                if (lang == "en") {
                    "$baseLabel — $dailyIncome / day"
                } else {
                    "$baseLabel — $dailyIncome / день"
                }
            } else {
                baseLabel
            }
        }
        if (id == RouletteUpgradeId.NOCTURNAL_CREATURE) {
            return if (lang == "en") "Nocturnal Creature (Cost: 10)" else "Нічна істота (Ціна: 10)"
        }
        val baseName = if (lang == "en") nameEn else nameUk
        val costPart = if (lang == "en") "(Cost: $cost)" else "(Ціна: $cost)"
        return if (isPurchased) {
            val boughtTag = if (lang == "en") "Purchased" else "Куплено"
            "$baseName $costPart — $boughtTag"
        } else {
            "$baseName $costPart"
        }
    }
}

data class TicketStainPlacement(
    val stainOffsetX: Float = 0.5f,
    val stainOffsetY: Float = 0.5f,
    val stainRadiusRatio: Float = 0.32f,
    val stainRotationDeg: Float = 0f,
    val stainIntensity: Float = 0f,
    val wrinkleDepth: Float = 0.1f,
    val textureFlipX: Boolean = false,
    val textureFlipY: Boolean = false
)

data class RouletteTicketItem(
    val index: Int,
    val slotLabel: String,
    val isRed: Boolean,
    val isGolden: Boolean = false,
    val isX2: Boolean = false,
    val visualVariant: TicketVisualVariant = TicketVisualVariant.PRISTINE,
    val stainPlacement: TicketStainPlacement = TicketStainPlacement(),
    val isRevealed: Boolean = false
)

data class RouletteStateModel(
    val screen: RouletteScreenMode = RouletteScreenMode.START,
    val score: Int = 0,
    val bestScore: Int = 0, // Persistent all-time best score achieved by the user
    val powerPoints: Int = 0, // Persistent Power Points ("Бали Потужності") accumulated upon Game Over
    val purchasedUpgrades: Set<RouletteUpgradeId> = emptySet(), // Persistent upgrades from Power Shop
    val depositCount: Int = 0, // Number of times "Deposit Power Points (100)" has been purchased
    val payoutDateMs: Long = 0L, // Recorded system timestamp when Game was loaded ("payout date")
    val depositFinMonLocked: Boolean = false, // True if system clock moved prior to recorded payoutDateMs ("На розгляді ФінМоніторинга")
    val secondChanceUsed: Boolean = false, // Whether "Second chance" upgrade was used in current game
    val extraLivesTotal: Int = 0, // Total extra heart lives available on game start (0..2 from Second Chance + Perseverance)
    val extraLivesUsed: Int = 0, // Number of extra heart lives consumed during the current game
    val dailyStreakApplied: Boolean = false, // True if Daily Streak X2 bonus was applied before Game Over in this game
    val powerPointsAwarded: Boolean = false, // Prevents double-adding score to powerPoints in one Game Over
    val streakIncrement: Int = 1,
    val refreshCount: Int = 0, // Cost of refreshing tickets: 0 first time, then 1 (-1), 2 (-2), 3 (-3)...
    val queueId: String = "1.1",
    val isOfflineRandomized: Boolean = false,
    val tickets: List<RouletteTicketItem> = emptyList(),
    val generationId: Int = 0,
    val ticketsShuffledAbove999: Boolean = false
)

data class ShareCardUpgradeGlyphState(
    val id: String,
    val kind: String,
    val purchased: Boolean,
    val colorHex: String,
    val depositPoints: Int = 0
)

data class RouletteRevealResult(
    val nextState: RouletteStateModel,
    val outcome: TicketRevealOutcome,
    val shuffled: Boolean = false
)

data class RoulettePurchaseResult(
    val nextState: RouletteStateModel,
    val purchased: Boolean,
    val triggerBlackCatNotification: Boolean
)

data class DepositLaunchPayoutResult(
    val powerPoints: Int,
    val depositCount: Int,
    val payoutDateMs: Long,
    val depositFinMonLocked: Boolean,
    val awardedPoints: Int
)

/**
 * Pure game logic & state machine for "Житомирська Рулетка"
 */
object ZhytomyrRouletteEngine {
    private const val PREFS_NAME = "zt_roulette_prefs"
    private const val KEY_BEST_SCORE = "best_score"
    private const val KEY_POWER_POINTS = "power_points"
    private const val KEY_ACCUMULATED_POWER_POINTS = "accumulated_power_points"
    private const val KEY_REACHED_MILESTONES = "reached_milestones"
    private const val KEY_LAST_DAILY_STREAK_DATE = "last_daily_streak_date"
    private const val KEY_PURCHASED_UPGRADES = "purchased_upgrades"
    private const val KEY_DEPOSIT_COUNT = "deposit_count"
    private const val KEY_PAYOUT_DATE_MS = "payout_date_ms"
    private const val KEY_DEPOSIT_BASE_TS_MS = "deposit_base_ts_ms"
    private const val KEY_DEPOSIT_FINMON_LOCKED = "deposit_finmon_locked"

    const val TICKET_SCRATCH_REVEAL_THRESHOLD = 0.30f
    const val MAX_ROULETTE_SCORE = 9_999_999
    const val SCORE_SHUFFLE_THRESHOLD = 999
    const val TICKET_SHUFFLE_ANIMATION_DURATION_MS = 2000L
    const val TICKET_SHUFFLE_ROW_COUNT = 24
    const val DEPOSIT_DAILY_REWARD_PER_STACK = 10
    const val DAY_IN_MS = 24L * 60L * 60L * 1000L
    const val GAME_OVER_REALIZATION_DELAY_MS = 1000L
    const val GAME_BLACKOUT_MIN_INTERVAL_MS = 5L * 60L * 1000L
    const val GAME_BLACKOUT_MAX_INTERVAL_MS = 10L * 60L * 1000L
    const val GAME_BLACKOUT_DURATION_MS = 10L * 1000L
    const val SHARE_GLYPH_INACTIVE_COLOR = "#6B7280"
    const val SHARE_GLYPH_ACTIVE_COLOR = "#F59E0B"

    fun clampRouletteScore(score: Int): Int {
        return score.coerceIn(0, MAX_ROULETTE_SCORE)
    }

    fun shuffleTicketPlaces(
        tickets: List<RouletteTicketItem>,
        random: Random = Random.Default
    ): List<RouletteTicketItem> {
        if (tickets.size <= 1) return tickets
        val copy = tickets.toMutableList()
        for (i in copy.lastIndex downTo 1) {
            val j = random.nextInt(i + 1)
            val tmp = copy[i]
            copy[i] = copy[j]
            copy[j] = tmp
        }
        val isStillOrdered = copy.withIndex().all { (idx, t) -> t.slotLabel == tickets[idx].slotLabel }
        if (isStillOrdered && copy.size >= 2) {
            val first = copy[0]
            copy[0] = copy[copy.lastIndex]
            copy[copy.lastIndex] = first
        }
        return copy.mapIndexed { idx, item -> item.copy(index = idx) }
    }

    val POWER_POINT_MILESTONES = listOf(100, 200, 400, 600, 1000)

    @Volatile
    private var inMemoryBestScore: Int = 0

    @Volatile
    private var inMemoryPowerPoints: Int = 0

    @Volatile
    private var inMemoryAccumulatedPowerPoints: Int = 0

    @Volatile
    private var inMemoryReachedMilestones: Set<Int> = emptySet()

    @Volatile
    private var inMemoryLastDailyStreakDate: String = ""

    @Volatile
    private var inMemoryPurchasedUpgrades: Set<RouletteUpgradeId> = emptySet()

    @Volatile
    private var inMemoryDepositCount: Int = 0

    @Volatile
    private var inMemoryPayoutDateMs: Long = 0L

    @Volatile
    private var inMemoryDepositBaseTsMs: Long = 0L

    @Volatile
    private var inMemoryDepositFinMonLocked: Boolean = false

    val ALL_QUEUES = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )

    val VISUAL_VARIANTS = TicketVisualVariant.values()

    val UPGRADES = listOf(
        RouletteUpgradeDef(
            id = RouletteUpgradeId.X2_TICKET_1,
            cost = 100,
            nameUk = "Додатковий білет X2",
            nameEn = "Additional X2 ticket",
            descriptionUk = "Додає ще 1 білет X2 на поле.",
            descriptionEn = "Adds 1 more x2 ticket on field."
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.X2_TICKET_2,
            cost = 200,
            nameUk = "Додатковий білет X2",
            nameEn = "Additional X2 ticket",
            descriptionUk = "Додає ще 1 білет X2 на поле.",
            descriptionEn = "Adds 1 more x2 ticket on field."
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.X2_TICKET_3,
            cost = 400,
            nameUk = "Додатковий білет X2",
            nameEn = "Additional X2 ticket",
            descriptionUk = "Додає ще 1 білет X2 на поле.",
            descriptionEn = "Adds 1 more x2 ticket on field."
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.FRIEND_ZTOE,
            cost = 200,
            nameUk = "Друг у Житомиробленерго",
            nameEn = "Friend in Zhytomyroblenergo",
            descriptionUk = "Миттєво відкриває один безпечний білет на старті гри.",
            descriptionEn = "Immediately reveal one safe ticket on game start."
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.SECOND_CHANCE,
            cost = 1000,
            nameUk = "Другий шанс",
            nameEn = "Second chance",
            descriptionUk = "Стирання червоного білета не викликає блекаут і рахується як світлий білет.",
            descriptionEn = "Scratching Red ticket will not trigger Game Over event and will count as beige ticket."
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.FERN_FLOWER,
            cost = 2000,
            nameUk = "Цвіт папороті",
            nameEn = "Fern flower",
            descriptionUk = "Удача +5%",
            descriptionEn = "Luck +5%",
            hideDescription = false
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.BLACK_CAT,
            cost = 13,
            nameUk = "Чорний кіт",
            nameEn = "Black Cat",
            descriptionUk = "Приносить невдачу",
            descriptionEn = "Brings misfortune",
            hideDescription = false
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.NOCTURNAL_CREATURE,
            cost = 10,
            nameUk = "Нічна істота",
            nameEn = "Nocturnal Creature",
            descriptionUk = "Тепер блекаут вам до вподоби",
            descriptionEn = "You love blackouts",
            hideDescription = false,
            isToggleable = true
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.DEPOSIT_POWER_POINTS,
            cost = 100,
            nameUk = "Депозит Потужність+",
            nameEn = "Deposit Power Points",
            descriptionUk = "Кожні 100 вкладених Балів Потужності приносять 10 Балів доходу щодня.",
            descriptionEn = "Each 100 Power Points deposited will grant you 10 Points income daily.",
            hideDescription = false,
            isRepeatable = true
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.DAILY_STREAK,
            cost = 0,
            nameUk = "Щоденна серія",
            nameEn = "Daily Streak",
            descriptionUk = "Нагорода за рубіж 400: перша гра на день дає бонус X2 до балів перед завершенням гри.",
            descriptionEn = "Milestone 400 reward: first Game in a Day grants X2 bonus points before Game Over event.",
            hideDescription = false,
            requiredMilestone = 400
        ),
        RouletteUpgradeDef(
            id = RouletteUpgradeId.PERSEVERANCE,
            cost = 0,
            nameUk = "Наполегливість",
            nameEn = "Perseverance",
            descriptionUk = "Нагорода за рубіж 1000: додає ще одне серце на головному екрані гри (до трьох життів разом із Другим шансом).",
            descriptionEn = "Milestone 1000 reward: adds one more heart icon in Main Game screen. Cumulative with Second Life up to three lives.",
            hideDescription = false,
            requiredMilestone = 1000
        )
    )

    fun getUpgradeDescription(
        upgrade: RouletteUpgradeDef,
        lang: String,
        depositFinMonLocked: Boolean = isDepositFinMonLocked()
    ): String {
        if (upgrade.id == RouletteUpgradeId.DEPOSIT_POWER_POINTS) {
            return if (depositFinMonLocked) {
                "На розгляді ФінМоніторинга"
            } else if (lang == "en") {
                upgrade.descriptionEn
            } else {
                upgrade.descriptionUk
            }
        }
        if (upgrade.hideDescription) {
            return ""
        }
        return if (lang == "en") upgrade.descriptionEn else upgrade.descriptionUk
    }

    fun isTicketScratchedEnough(scratchedFraction: Float, isCenterShown: Boolean = false): Boolean {
        return isCenterShown || scratchedFraction >= TICKET_SCRATCH_REVEAL_THRESHOLD
    }

    fun doesScratchExposeLightbulbCenter(
        x0: Float,
        y0: Float,
        x1: Float,
        y1: Float,
        canvasWidth: Float,
        canvasHeight: Float,
        brushRadius: Float
    ): Boolean {
        if (canvasWidth <= 0f || canvasHeight <= 0f) return false
        val cx = canvasWidth / 2f
        val cy = canvasHeight / 2f
        val bulbRadius = min(canvasWidth, canvasHeight) * 0.25f

        val dx = x1 - x0
        val dy = y1 - y0
        val segLenSq = dx * dx + dy * dy
        val t = if (segLenSq > 0.0001f) {
            (((cx - x0) * dx + (cy - y0) * dy) / segLenSq).coerceIn(0f, 1f)
        } else {
            0f
        }
        val closestX = x0 + t * dx
        val closestY = y0 + t * dy
        val rx = bulbRadius + brushRadius * 0.5f
        val ry = bulbRadius + brushRadius * 0.5f
        val normX = (cx - closestX) / max(1f, rx)
        val normY = (cy - closestY) / max(1f, ry)
        return normX * normX + normY * normY <= 1f
    }

    fun doesScratchExposeCenter(
        x0: Float,
        y0: Float,
        x1: Float,
        y1: Float,
        canvasWidth: Float,
        canvasHeight: Float,
        brushRadius: Float
    ): Boolean = doesScratchExposeLightbulbCenter(x0, y0, x1, y1, canvasWidth, canvasHeight, brushRadius)

    fun doesScratchExposeRedCenterOutline(
        x0: Float,
        y0: Float,
        x1: Float,
        y1: Float,
        canvasWidth: Float,
        canvasHeight: Float,
        brushRadius: Float
    ): Boolean = doesScratchExposeLightbulbCenter(x0, y0, x1, y1, canvasWidth, canvasHeight, brushRadius)

    fun isNocturnalModeActive(purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()): Boolean {
        return purchasedUpgrades.contains(RouletteUpgradeId.NOCTURNAL_CREATURE)
    }

    fun getStreakStep(purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()): Int {
        return if (isNocturnalModeActive(purchasedUpgrades)) 2 else 1
    }

    fun getSavedBestScore(context: Context? = null): Int {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val stored = clampRouletteScore(prefs.getInt(KEY_BEST_SCORE, 0))
                if (stored > inMemoryBestScore) {
                    inMemoryBestScore = stored
                }
            } catch (_: Exception) {}
        }
        return clampRouletteScore(inMemoryBestScore)
    }

    fun saveBestScoreIfHigher(candidateScore: Int, context: Context? = null): Int {
        val sanitized = clampRouletteScore(candidateScore)
        val currentBest = getSavedBestScore(context)
        val nextBest = clampRouletteScore(max(currentBest, sanitized))
        inMemoryBestScore = nextBest
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putInt(KEY_BEST_SCORE, nextBest).apply()
            } catch (_: Exception) {}
        }
        return nextBest
    }

    fun resetSavedBestScore(initialValue: Int = 0, context: Context? = null) {
        val sanitized = clampRouletteScore(initialValue)
        inMemoryBestScore = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putInt(KEY_BEST_SCORE, sanitized).apply()
            } catch (_: Exception) {}
        }
    }

    fun getSavedPowerPoints(context: Context? = null): Int {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryPowerPoints = prefs.getInt(KEY_POWER_POINTS, inMemoryPowerPoints).coerceAtLeast(0)
            } catch (_: Exception) {}
        }
        return inMemoryPowerPoints
    }

    fun savePowerPoints(points: Int, context: Context? = null): Int {
        val sanitized = points.coerceAtLeast(0)
        inMemoryPowerPoints = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putInt(KEY_POWER_POINTS, sanitized).apply()
            } catch (_: Exception) {}
        }
        return sanitized
    }

    fun getAccumulatedPowerPoints(context: Context? = null): Int {
        val currentBalance = getSavedPowerPoints(context)
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryAccumulatedPowerPoints = prefs.getInt(KEY_ACCUMULATED_POWER_POINTS, inMemoryAccumulatedPowerPoints).coerceAtLeast(0)
            } catch (_: Exception) {}
        }
        return max(inMemoryAccumulatedPowerPoints, currentBalance)
    }

    fun saveAccumulatedPowerPoints(total: Int, context: Context? = null): Int {
        val sanitized = total.coerceAtLeast(0)
        inMemoryAccumulatedPowerPoints = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putInt(KEY_ACCUMULATED_POWER_POINTS, sanitized).apply()
            } catch (_: Exception) {}
        }
        return sanitized
    }

    fun getReachedMilestones(context: Context? = null): Set<Int> {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val rawSet = prefs.getStringSet(KEY_REACHED_MILESTONES, null)
                if (rawSet != null) {
                    inMemoryReachedMilestones = rawSet.mapNotNull { it.toIntOrNull() }
                        .filter { POWER_POINT_MILESTONES.contains(it) }
                        .toSet()
                }
            } catch (_: Exception) {}
        }
        return inMemoryReachedMilestones
    }

    fun saveReachedMilestones(milestones: Set<Int>, context: Context? = null): Set<Int> {
        val filtered = milestones.filter { POWER_POINT_MILESTONES.contains(it) }.toSet()
        inMemoryReachedMilestones = filtered
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putStringSet(KEY_REACHED_MILESTONES, filtered.map { it.toString() }.toSet()).apply()
            } catch (_: Exception) {}
        }
        return inMemoryReachedMilestones
    }

    fun isMilestoneReached(milestone: Int, context: Context? = null): Boolean {
        return getReachedMilestones(context).contains(milestone) || getAccumulatedPowerPoints(context) >= milestone
    }

    fun getMilestoneProgressFraction(accumulatedPoints: Int = getAccumulatedPowerPoints()): Float {
        val clamped = accumulatedPoints.coerceIn(0, 1000)
        return clamped.toFloat() / 1000f
    }

    fun formatLocalDayKey(nowMs: Long = System.currentTimeMillis()): String {
        val d = java.util.Calendar.getInstance().apply { timeInMillis = nowMs }
        val y = d.get(java.util.Calendar.YEAR)
        val m = d.get(java.util.Calendar.MONTH) + 1
        val day = d.get(java.util.Calendar.DAY_OF_MONTH)
        return String.format("%04d-%02d-%02d", y, m, day)
    }

    fun getLastDailyStreakDateStr(context: Context? = null): String {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryLastDailyStreakDate = prefs.getString(KEY_LAST_DAILY_STREAK_DATE, inMemoryLastDailyStreakDate) ?: ""
            } catch (_: Exception) {}
        }
        return inMemoryLastDailyStreakDate
    }

    fun saveLastDailyStreakDateStr(dateStr: String, context: Context? = null) {
        inMemoryLastDailyStreakDate = dateStr
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_LAST_DAILY_STREAK_DATE, dateStr).apply()
            } catch (_: Exception) {}
        }
    }

    fun addPowerPoints(earnedPoints: Int, context: Context? = null): Int {
        val delta = earnedPoints.coerceAtLeast(0)
        val current = getSavedPowerPoints(context)
        if (delta == 0) return current

        var nextBalance = current + delta
        var nextAccumulated = getAccumulatedPowerPoints(context) + delta
        val reached = getReachedMilestones(context).toMutableSet()

        var milestoneBonusAdded = true
        while (milestoneBonusAdded) {
            milestoneBonusAdded = false
            for (m in POWER_POINT_MILESTONES) {
                if (!reached.contains(m) && nextAccumulated >= m) {
                    reached.add(m)
                    // Milestones 100, 200, 600 directly add their value to User's total Power Points
                    if (m != 400 && m != 1000) {
                        nextBalance += m
                        nextAccumulated += m
                        milestoneBonusAdded = true
                    }
                }
            }
        }

        saveReachedMilestones(reached, context)
        saveAccumulatedPowerPoints(nextAccumulated, context)
        return savePowerPoints(nextBalance, context)
    }

    fun resetSavedPowerPoints(initialValue: Int = 0, context: Context? = null) {
        val sanitized = initialValue.coerceAtLeast(0)
        saveAccumulatedPowerPoints(sanitized, context)
        val reached = POWER_POINT_MILESTONES.filter { sanitized >= it }.toSet()
        saveReachedMilestones(reached, context)
        savePowerPoints(sanitized, context)
    }

    fun getPurchasedUpgrades(context: Context? = null): Set<RouletteUpgradeId> {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val rawSet = prefs.getStringSet(KEY_PURCHASED_UPGRADES, null)
                if (rawSet != null) {
                    inMemoryPurchasedUpgrades = rawSet.mapNotNull { RouletteUpgradeId.fromKey(it) }.toSet()
                }
            } catch (_: Exception) {}
        }
        return inMemoryPurchasedUpgrades
    }

    fun savePurchasedUpgrades(upgrades: Set<RouletteUpgradeId>, context: Context? = null): Set<RouletteUpgradeId> {
        inMemoryPurchasedUpgrades = upgrades.toSet()
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putStringSet(KEY_PURCHASED_UPGRADES, upgrades.map { it.key }.toSet()).apply()
            } catch (_: Exception) {}
        }
        return inMemoryPurchasedUpgrades
    }

    fun resetPurchasedUpgrades(initialUpgrades: Set<RouletteUpgradeId> = emptySet(), context: Context? = null) {
        savePurchasedUpgrades(initialUpgrades, context)
    }

    fun getDepositCount(context: Context? = null): Int {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryDepositCount = prefs.getInt(KEY_DEPOSIT_COUNT, inMemoryDepositCount).coerceAtLeast(0)
            } catch (_: Exception) {}
        }
        return inMemoryDepositCount
    }

    fun saveDepositCount(count: Int, context: Context? = null): Int {
        val sanitized = count.coerceAtLeast(0)
        inMemoryDepositCount = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putInt(KEY_DEPOSIT_COUNT, sanitized).apply()
            } catch (_: Exception) {}
        }
        return sanitized
    }

    fun getRecordedPayoutDateMs(context: Context? = null): Long {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryPayoutDateMs = prefs.getLong(KEY_PAYOUT_DATE_MS, inMemoryPayoutDateMs).coerceAtLeast(0L)
            } catch (_: Exception) {}
        }
        return inMemoryPayoutDateMs
    }

    fun saveRecordedPayoutDateMs(dateMs: Long, context: Context? = null): Long {
        val sanitized = dateMs.coerceAtLeast(0L)
        inMemoryPayoutDateMs = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putLong(KEY_PAYOUT_DATE_MS, sanitized).apply()
            } catch (_: Exception) {}
        }
        return sanitized
    }

    fun getDepositBaseTimestampMs(context: Context? = null): Long {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryDepositBaseTsMs = prefs.getLong(KEY_DEPOSIT_BASE_TS_MS, inMemoryDepositBaseTsMs).coerceAtLeast(0L)
            } catch (_: Exception) {}
        }
        return inMemoryDepositBaseTsMs
    }

    fun saveDepositBaseTimestampMs(tsMs: Long, context: Context? = null): Long {
        val sanitized = tsMs.coerceAtLeast(0L)
        inMemoryDepositBaseTsMs = sanitized
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putLong(KEY_DEPOSIT_BASE_TS_MS, sanitized).apply()
            } catch (_: Exception) {}
        }
        return sanitized
    }

    fun isDepositFinMonLocked(context: Context? = null): Boolean {
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                inMemoryDepositFinMonLocked = prefs.getBoolean(KEY_DEPOSIT_FINMON_LOCKED, inMemoryDepositFinMonLocked)
            } catch (_: Exception) {}
        }
        return inMemoryDepositFinMonLocked
    }

    fun saveDepositFinMonLocked(locked: Boolean, context: Context? = null): Boolean {
        inMemoryDepositFinMonLocked = locked
        if (context != null) {
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putBoolean(KEY_DEPOSIT_FINMON_LOCKED, locked).apply()
            } catch (_: Exception) {}
        }
        return locked
    }

    fun resetDepositState(context: Context? = null) {
        saveDepositCount(0, context)
        saveRecordedPayoutDateMs(0L, context)
        saveDepositBaseTimestampMs(0L, context)
        saveDepositFinMonLocked(false, context)
    }

    fun resetAllProgress(context: Context? = null) {
        resetSavedBestScore(0, context)
        resetSavedPowerPoints(0, context)
        saveAccumulatedPowerPoints(0, context)
        saveReachedMilestones(emptySet(), context)
        saveLastDailyStreakDateStr("", context)
        resetPurchasedUpgrades(emptySet(), context)
        resetDepositState(context)
        RouletteSoundEngine.setSoundEnabled(true, context)
        RouletteSoundEngine.setMusicEnabled(true, context)
    }

    fun processGameLaunchDepositPayout(
        nowMs: Long = System.currentTimeMillis(),
        context: Context? = null
    ): DepositLaunchPayoutResult {
        val previousPayoutDateMs = getRecordedPayoutDateMs(context)
        val depositCount = getDepositCount(context)
        val alreadyLocked = isDepositFinMonLocked(context)

        // AntiCheat: If current system date became prior to already recorded payout date:
        // disable this Upgrade, set current User's Power Points to 0, add description "На розгляді ФінМоніторинга",
        // and permanently disable Deposit payout events after following 24-hour intervals.
        if (previousPayoutDateMs > 0L && nowMs < previousPayoutDateMs) {
            saveDepositFinMonLocked(true, context)
            saveDepositBaseTimestampMs(0L, context)
            val zeroed = savePowerPoints(0, context)
            return DepositLaunchPayoutResult(
                powerPoints = zeroed,
                depositCount = depositCount,
                payoutDateMs = previousPayoutDateMs,
                depositFinMonLocked = true,
                awardedPoints = 0
            )
        }

        val recordedPayoutDateMs = saveRecordedPayoutDateMs(nowMs, context)

        if (alreadyLocked) {
            saveDepositBaseTimestampMs(0L, context)
            return DepositLaunchPayoutResult(
                powerPoints = getSavedPowerPoints(context),
                depositCount = depositCount,
                payoutDateMs = recordedPayoutDateMs,
                depositFinMonLocked = true,
                awardedPoints = 0
            )
        }

        var awardedPoints = 0
        if (depositCount > 0) {
            val baseTs = getDepositBaseTimestampMs(context)
            if (baseTs <= 0L) {
                saveDepositBaseTimestampMs(nowMs, context)
            } else if (nowMs >= baseTs + DAY_IN_MS) {
                val passedDays = ((nowMs - baseTs) / DAY_IN_MS).toInt()
                if (passedDays > 0) {
                    awardedPoints = passedDays * depositCount * DEPOSIT_DAILY_REWARD_PER_STACK
                    addPowerPoints(awardedPoints, context)
                    saveDepositBaseTimestampMs(baseTs + passedDays * DAY_IN_MS, context)
                }
            }
        }

        return DepositLaunchPayoutResult(
            powerPoints = getSavedPowerPoints(context),
            depositCount = depositCount,
            payoutDateMs = recordedPayoutDateMs,
            depositFinMonLocked = false,
            awardedPoints = awardedPoints
        )
    }

    fun getGoldenTicketProbability(purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()): Double {
        return if (purchasedUpgrades.contains(RouletteUpgradeId.FERN_FLOWER)) 0.05 else 0.01
    }

    fun getExtraLivesCount(purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()): Int {
        var lives = 0
        if (purchasedUpgrades.contains(RouletteUpgradeId.SECOND_CHANCE)) lives += 1
        if (purchasedUpgrades.contains(RouletteUpgradeId.PERSEVERANCE)) lives += 1
        return lives
    }

    fun canRefreshTickets(score: Int, refreshCount: Int): Boolean {
        return score >= refreshCount.coerceAtLeast(0)
    }

    fun getNextGameBlackoutDelayMs(random: Random = Random.Default): Long {
        return GAME_BLACKOUT_MIN_INTERVAL_MS +
            random.nextLong(GAME_BLACKOUT_MAX_INTERVAL_MS - GAME_BLACKOUT_MIN_INTERVAL_MS + 1L)
    }

    fun getShareCardUpgradeGlyphStates(
        purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades(),
        depositCount: Int = getDepositCount()
    ): List<ShareCardUpgradeGlyphState> {
        val sanitizedDeposit = depositCount.coerceAtLeast(0)
        val specs = listOf(
            Pair("x2_ticket_1", "x2"),
            Pair("x2_ticket_2", "x2"),
            Pair("x2_ticket_3", "x2"),
            Pair("friend_ztoe", "person"),
            Pair("second_chance", "heart"),
            Pair("fern_flower", "flower"),
            Pair("black_cat", "cat"),
            Pair("nocturnal_creature", "bat"),
            Pair("deposit_power_points", "deposit")
        )
        return specs.map { (idKey, kind) ->
            val upgradeId = RouletteUpgradeId.fromKey(idKey)
            val isBought = if (idKey == "deposit_power_points") {
                sanitizedDeposit > 0 || (upgradeId != null && purchasedUpgrades.contains(upgradeId))
            } else {
                upgradeId != null && purchasedUpgrades.contains(upgradeId)
            }
            ShareCardUpgradeGlyphState(
                id = idKey,
                kind = kind,
                purchased = isBought,
                colorHex = if (isBought) SHARE_GLYPH_ACTIVE_COLOR else SHARE_GLYPH_INACTIVE_COLOR,
                depositPoints = if (idKey == "deposit_power_points") sanitizedDeposit * 100 else 0
            )
        }
    }

    fun getTargetX2TicketCount(purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()): Int {
        var count = 1
        if (purchasedUpgrades.contains(RouletteUpgradeId.X2_TICKET_1)) count += 1
        if (purchasedUpgrades.contains(RouletteUpgradeId.X2_TICKET_2)) count += 1
        if (purchasedUpgrades.contains(RouletteUpgradeId.X2_TICKET_3)) count += 1
        return count
    }

    fun generate48TimeslotLabels(): List<String> {
        return (0 until 48).map { index ->
            val startTotalMin = index * 30
            val endTotalMin = (index + 1) * 30
            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60
            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)
            "$startStr-$endStr"
        }
    }

    fun getHourlyTicketPairs(tickets: List<RouletteTicketItem>): List<Pair<RouletteTicketItem, RouletteTicketItem>> {
        val pairs = ArrayList<Pair<RouletteTicketItem, RouletteTicketItem>>(24)
        for (hour in 0 until 24) {
            val first = tickets.getOrNull(hour * 2)
            val second = tickets.getOrNull(hour * 2 + 1)
            if (first != null && second != null) {
                pairs.add(Pair(first, second))
            }
        }
        return pairs
    }

    fun getNextFlickerDelayMs(random: Random = Random.Default): Long {
        return 15_000L + random.nextLong(15_001L)
    }

    fun getFlickerDurationMs(random: Random = Random.Default): Long {
        return 2_000L + random.nextLong(1_001L)
    }

    fun generateRandomStainPlacement(
        variant: TicketVisualVariant,
        random: Random = Random.Default
    ): TicketStainPlacement {
        val isStained = variant == TicketVisualVariant.CUP_STAIN ||
            variant == TicketVisualVariant.STAIN_CORNER ||
            variant == TicketVisualVariant.WATER_STAINS ||
            variant == TicketVisualVariant.HEAVY_WEAR
        val isProfoundWrinkled = variant == TicketVisualVariant.DEEP_WRINKLED ||
            variant == TicketVisualVariant.CRUMPLED_SCRATCHED ||
            variant == TicketVisualVariant.HEAVY_WEAR ||
            variant == TicketVisualVariant.WRINKLED

        return TicketStainPlacement(
            stainOffsetX = 0.12f + random.nextFloat() * 0.76f,
            stainOffsetY = 0.15f + random.nextFloat() * 0.70f,
            stainRadiusRatio = 0.22f + random.nextFloat() * 0.26f,
            stainRotationDeg = random.nextFloat() * 360f,
            stainIntensity = when {
                isStained -> 0.55f + random.nextFloat() * 0.42f
                variant == TicketVisualVariant.PRISTINE -> 0f
                else -> 0.18f + random.nextFloat() * 0.35f
            },
            wrinkleDepth = when {
                isProfoundWrinkled -> 0.65f + random.nextFloat() * 0.35f
                variant == TicketVisualVariant.PRISTINE -> 0.05f
                else -> 0.25f + random.nextFloat() * 0.35f
            },
            textureFlipX = random.nextBoolean(),
            textureFlipY = random.nextBoolean()
        )
    }

    /**
     * Assigns non-uniform generated ticket image variants (9 variants including profound wrinkled & stained tickets),
     * randomized stain placements, Golden ticket probability (1% default or 3% with Fern flower upgrade),
     * and X2 multiplier beige tickets (at least 1 beige ticket by default + 1 per Additional X2 upgrade).
     */
    fun assignGoldenTicketAndVariants(
        tickets: List<RouletteTicketItem>,
        random: Random = Random.Default,
        purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()
    ): List<RouletteTicketItem> {
        val nocturnal = isNocturnalModeActive(purchasedUpgrades)
        val isSafeTicket: (RouletteTicketItem) -> Boolean = { if (nocturnal) it.isRed else !it.isRed }
        val safeIndices = tickets.mapIndexedNotNull { idx, item -> if (isSafeTicket(item)) idx else null }
        val goldenProb = getGoldenTicketProbability(purchasedUpgrades)
        val existingGoldenIdx = tickets.indexOfFirst { isSafeTicket(it) && it.isGolden }
        val hasGolden = existingGoldenIdx >= 0 || (safeIndices.isNotEmpty() && random.nextDouble() < goldenProb)
        val chosenGoldenIdx = when {
            existingGoldenIdx >= 0 -> existingGoldenIdx
            hasGolden -> safeIndices[random.nextInt(safeIndices.size)]
            else -> -1
        }

        val targetX2Count = getTargetX2TicketCount(purchasedUpgrades)
        val chosenX2Indices = mutableSetOf<Int>()
        tickets.forEachIndexed { idx, item ->
            if (isSafeTicket(item) && idx != chosenGoldenIdx && item.isX2) {
                chosenX2Indices.add(idx)
            }
        }

        val candidateX2Pool = safeIndices.filter { it != chosenGoldenIdx && !chosenX2Indices.contains(it) }
        val preferredPool = if (candidateX2Pool.drop(4).size >= targetX2Count - chosenX2Indices.size) {
            candidateX2Pool.drop(4).toMutableList()
        } else {
            candidateX2Pool.reversed().toMutableList()
        }

        while (chosenX2Indices.size < targetX2Count && preferredPool.isNotEmpty()) {
            val pickIdx = random.nextInt(preferredPool.size)
            chosenX2Indices.add(preferredPool.removeAt(pickIdx))
        }

        return tickets.mapIndexed { idx, item ->
            val variant = VISUAL_VARIANTS[random.nextInt(VISUAL_VARIANTS.size)]
            val placement = generateRandomStainPlacement(variant, random)
            val isGolden = isSafeTicket(item) && idx == chosenGoldenIdx
            val isX2 = isSafeTicket(item) && !isGolden && chosenX2Indices.contains(idx)
            item.copy(
                isGolden = isGolden,
                isX2 = isX2,
                visualVariant = variant,
                stainPlacement = placement
            )
        }
    }

    fun createTicketsFromSlots(
        slots: List<BlackoutSlot>,
        random: Random = Random.Default,
        purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()
    ): List<RouletteTicketItem> {
        val labels = generate48TimeslotLabels()
        val is48 = slots.size >= 48
        val base = labels.mapIndexed { index, label ->
            val slot = if (is48) slots.getOrNull(index) else slots.getOrNull(index / 2)
            RouletteTicketItem(
                index = index,
                slotLabel = label,
                isRed = slot?.status == SlotStatus.POWER_OFF,
                isRevealed = false
            )
        }
        return assignGoldenTicketAndVariants(base, random, purchasedUpgrades)
    }

    fun generateRandomizedTickets(
        random: Random = Random.Default,
        purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()
    ): List<RouletteTicketItem> {
        val labels = generate48TimeslotLabels()
        val list = labels.mapIndexed { index, label ->
            RouletteTicketItem(
                index = index,
                slotLabel = label,
                isRed = random.nextDouble() < 0.32,
                isRevealed = false
            )
        }.toMutableList()

        if (list.none { it.isRed } && list.isNotEmpty()) {
            val idx = random.nextInt(list.size)
            list[idx] = list[idx].copy(isRed = true)
        }
        if (list.none { !it.isRed } && list.size > 1) {
            val idx = random.nextInt(list.size)
            list[idx] = list[idx].copy(isRed = false)
        }
        return assignGoldenTicketAndVariants(list, random, purchasedUpgrades)
    }

    private fun normalizeTicketsForGame(
        tickets: List<RouletteTicketItem>,
        purchasedUpgrades: Set<RouletteUpgradeId>,
        random: Random = Random.Default
    ): List<RouletteTicketItem> {
        val nocturnal = isNocturnalModeActive(purchasedUpgrades)
        val isSafe: (RouletteTicketItem) -> Boolean = { if (nocturnal) it.isRed else !it.isRed }
        val targetX2Count = getTargetX2TicketCount(purchasedUpgrades)
        val hasExplicitGolden = tickets.any { isSafe(it) && it.isGolden }
        val hasEnoughX2 = tickets.count { isSafe(it) && !it.isGolden && it.isX2 } >= targetX2Count

        val prepared = if (hasEnoughX2) {
            tickets.map {
                it.copy(
                    isGolden = isSafe(it) && it.isGolden,
                    isX2 = isSafe(it) && !it.isGolden && it.isX2,
                    isRevealed = false
                )
            }
        } else if (!hasExplicitGolden) {
            assignGoldenTicketAndVariants(tickets, random, purchasedUpgrades).map { it.copy(isRevealed = false) }
        } else {
            val chosenX2 = mutableSetOf<Int>()
            tickets.forEachIndexed { idx, t ->
                if (isSafe(t) && !t.isGolden && t.isX2) chosenX2.add(idx)
            }
            val candidates = tickets.mapIndexedNotNull { idx, t ->
                if (isSafe(t) && !t.isGolden && !chosenX2.contains(idx)) idx else null
            }
            val pool = if (candidates.drop(4).size >= targetX2Count - chosenX2.size) {
                candidates.drop(4).toMutableList()
            } else {
                candidates.reversed().toMutableList()
            }
            while (chosenX2.size < targetX2Count && pool.isNotEmpty()) {
                chosenX2.add(pool.removeAt(random.nextInt(pool.size)))
            }
            tickets.mapIndexed { idx, t ->
                t.copy(
                    isGolden = isSafe(t) && t.isGolden,
                    isX2 = isSafe(t) && !t.isGolden && chosenX2.contains(idx),
                    isRevealed = false
                )
            }
        }
        return prepared
    }

    /**
     * Instantly loads a random queue from cached ScheduleRepository data instead of querying ztoe.com.ua over network.
     */
    fun loadCachedRandomQueueTickets(
        scheduleRepo: ScheduleRepository? = null,
        random: Random = Random.Default,
        purchasedUpgrades: Set<RouletteUpgradeId> = getPurchasedUpgrades()
    ): Triple<String, Boolean, List<RouletteTicketItem>> {
        val randomQueue = ALL_QUEUES[random.nextInt(ALL_QUEUES.size)]
        if (scheduleRepo != null) {
            val cachedSlots = scheduleRepo.getTodaySlots(randomQueue)
            if (cachedSlots.isNotEmpty()) {
                return Triple(randomQueue, false, createTicketsFromSlots(cachedSlots, random, purchasedUpgrades))
            }
        }
        return Triple(randomQueue, true, generateRandomizedTickets(random, purchasedUpgrades))
    }

    fun createInitialState(context: Context? = null, nowMs: Long = System.currentTimeMillis()): RouletteStateModel {
        val payoutRes = processGameLaunchDepositPayout(nowMs, context)
        val upgrades = getPurchasedUpgrades(context)
        val step = getStreakStep(upgrades)
        return RouletteStateModel(
            screen = RouletteScreenMode.START,
            score = 0,
            bestScore = getSavedBestScore(context),
            powerPoints = payoutRes.powerPoints,
            purchasedUpgrades = upgrades,
            depositCount = payoutRes.depositCount,
            payoutDateMs = payoutRes.payoutDateMs,
            depositFinMonLocked = payoutRes.depositFinMonLocked,
            secondChanceUsed = false,
            extraLivesTotal = getExtraLivesCount(upgrades),
            extraLivesUsed = 0,
            dailyStreakApplied = false,
            powerPointsAwarded = false,
            streakIncrement = step,
            refreshCount = 0,
            queueId = "1.1",
            isOfflineRandomized = false,
            tickets = generateRandomizedTickets(Random.Default, upgrades),
            generationId = 0
        )
    }

    fun startGame(
        queueId: String,
        isOfflineRandomized: Boolean,
        tickets: List<RouletteTicketItem>,
        prevGenerationId: Int = 0,
        prevBestScore: Int = getSavedBestScore(),
        explicitUpgrades: Set<RouletteUpgradeId>? = null,
        random: Random = Random.Default,
        context: Context? = null
    ): RouletteStateModel {
        val upgrades = explicitUpgrades ?: getPurchasedUpgrades(context)
        val powerPts = getSavedPowerPoints(context)
        val nocturnal = isNocturnalModeActive(upgrades)
        val step = getStreakStep(upgrades)
        var normalized = normalizeTicketsForGame(tickets, upgrades, random)
        var initialScore = 0
        var initialStreak = step

        // Upgrade d) "Friend in Zhytomyroblenergo": can open any ticket which doesn't trigger Game Over event (e.g. normal, "X2", or "Gold Ticket")
        if (upgrades.contains(RouletteUpgradeId.FRIEND_ZTOE)) {
            val safeIndices = normalized.mapIndexedNotNull { idx, item ->
                val isSafe = if (nocturnal) item.isRed else !item.isRed
                if (!item.isRevealed && isSafe) idx else null
            }
            if (safeIndices.isNotEmpty()) {
                val chosenSafeIdx = safeIndices[random.nextInt(safeIndices.size)]
                val chosenTicket = normalized[chosenSafeIdx]
                if (chosenTicket.isGolden) {
                    val isSafeGroup: (RouletteTicketItem) -> Boolean = { if (nocturnal) it.isRed else !it.isRed }
                    val unrevealedSafeCount = normalized.count { isSafeGroup(it) && !it.isRevealed }
                    val k = step
                    val n = unrevealedSafeCount
                    initialScore = n * k + step * ((n * (n - 1)) / 2)
                    initialStreak = k + n * step
                    normalized = normalized.map { item ->
                        if (isSafeGroup(item)) item.copy(isRevealed = true) else item
                    }
                } else if (chosenTicket.isX2) {
                    normalized = normalized.mapIndexed { idx, item ->
                        if (idx == chosenSafeIdx) item.copy(isRevealed = true) else item
                    }
                    initialScore = step * 2
                    initialStreak = step * 2
                } else {
                    normalized = normalized.mapIndexed { idx, item ->
                        if (idx == chosenSafeIdx) item.copy(isRevealed = true) else item
                    }
                    initialScore = step
                    initialStreak = step * 2
                }
            }
        }

        val clampedInitialScore = clampRouletteScore(initialScore)
        val currentBest = saveBestScoreIfHigher(max(prevBestScore, clampedInitialScore), context)
        return RouletteStateModel(
            screen = RouletteScreenMode.PLAYING,
            score = clampedInitialScore,
            bestScore = currentBest,
            powerPoints = powerPts,
            purchasedUpgrades = upgrades,
            depositCount = getDepositCount(context),
            payoutDateMs = getRecordedPayoutDateMs(context),
            depositFinMonLocked = isDepositFinMonLocked(context),
            secondChanceUsed = false,
            extraLivesTotal = getExtraLivesCount(upgrades),
            extraLivesUsed = 0,
            dailyStreakApplied = false,
            powerPointsAwarded = false,
            streakIncrement = initialStreak,
            refreshCount = 0,
            queueId = queueId,
            isOfflineRandomized = isOfflineRandomized,
            tickets = normalized,
            generationId = prevGenerationId + 1,
            ticketsShuffledAbove999 = false
        )
    }

    fun revealTicket(state: RouletteStateModel, ticketIndex: Int, context: Context? = null): RouletteRevealResult {
        if (state.screen != RouletteScreenMode.PLAYING) {
            return RouletteRevealResult(state, TicketRevealOutcome.NONE, shuffled = false)
        }
        val target = state.tickets.getOrNull(ticketIndex)
        if (target == null || target.isRevealed) {
            return RouletteRevealResult(state, TicketRevealOutcome.NONE, shuffled = false)
        }

        val activeUpgrades = state.purchasedUpgrades.ifEmpty { getPurchasedUpgrades(context) }
        val nocturnal = isNocturnalModeActive(activeUpgrades)
        val step = getStreakStep(activeUpgrades)
        val extraLivesTotal = max(state.extraLivesTotal, getExtraLivesCount(activeUpgrades))

        // Golden Ticket (1% or 5% chance):
        // - Normal mode: immediately scratches all Beige (!isRed) tickets on field and adds cumulative score
        // - Nocturnal Creature mode: immediately scratches all Red (isRed) tickets on field and adds cumulative score
        if (target.isGolden) {
            val isTargetSafeGroup: (RouletteTicketItem) -> Boolean = { if (nocturnal) it.isRed else !it.isRed }
            val unrevealedSafeCount = state.tickets.count { isTargetSafeGroup(it) && !it.isRevealed }
            val k = state.streakIncrement
            val n = unrevealedSafeCount
            val cumulativeAdded = n * k + step * ((n * (n - 1)) / 2)
            val nextScore = clampRouletteScore(state.score + cumulativeAdded)
            val nextBest = saveBestScoreIfHigher(max(state.bestScore, nextScore), context)
            val allSafeRevealed = state.tickets.mapIndexed { idx, item ->
                if (isTargetSafeGroup(item) || idx == ticketIndex) item.copy(isRevealed = true) else item
            }
            val shouldShuffle = nextScore > SCORE_SHUFFLE_THRESHOLD && !state.ticketsShuffledAbove999
            val finalTickets = if (shouldShuffle) shuffleTicketPlaces(allSafeRevealed) else allSafeRevealed
            return RouletteRevealResult(
                nextState = state.copy(
                    score = nextScore,
                    bestScore = nextBest,
                    streakIncrement = k + n * step,
                    tickets = finalTickets,
                    ticketsShuffledAbove999 = state.ticketsShuffledAbove999 || shouldShuffle
                ),
                outcome = TicketRevealOutcome.GOLDEN,
                shuffled = shouldShuffle
            )
        }

        // X2 Multiplier ticket: multiplies current score by x2 in both Normal and Nocturnal Creature modes
        if (target.isX2) {
            val updatedTickets = state.tickets.mapIndexed { idx, item ->
                if (idx == ticketIndex) item.copy(isRevealed = true) else item
            }
            val nextScore = clampRouletteScore(state.score * 2)
            val nextBest = saveBestScoreIfHigher(max(state.bestScore, nextScore), context)
            val shouldShuffle = nextScore > SCORE_SHUFFLE_THRESHOLD && !state.ticketsShuffledAbove999
            val finalTickets = if (shouldShuffle) shuffleTicketPlaces(updatedTickets) else updatedTickets
            return RouletteRevealResult(
                nextState = state.copy(
                    score = nextScore,
                    bestScore = nextBest,
                    streakIncrement = state.streakIncrement + step,
                    tickets = finalTickets,
                    ticketsShuffledAbove999 = state.ticketsShuffledAbove999 || shouldShuffle
                ),
                outcome = TicketRevealOutcome.X2,
                shuffled = shouldShuffle
            )
        }

        val isFatalTicket = if (nocturnal) !target.isRed else target.isRed

        if (isFatalTicket) {
            // Extra lives ("Second chance" + "Perseverance" cumulative up to 2 extra hearts = 3 lives total) work in both Normal and Nocturnal Creature modes
            if (extraLivesTotal > 0 && state.extraLivesUsed < extraLivesTotal) {
                val updatedTickets = state.tickets.mapIndexed { idx, item ->
                    if (idx == ticketIndex) item.copy(isRevealed = true) else item
                }
                val nextScore = clampRouletteScore(state.score + state.streakIncrement)
                val nextBest = saveBestScoreIfHigher(max(state.bestScore, nextScore), context)
                val nextExtraLivesUsed = state.extraLivesUsed + 1
                val shouldShuffle = nextScore > SCORE_SHUFFLE_THRESHOLD && !state.ticketsShuffledAbove999
                val finalTickets = if (shouldShuffle) shuffleTicketPlaces(updatedTickets) else updatedTickets
                return RouletteRevealResult(
                    nextState = state.copy(
                        score = nextScore,
                        bestScore = nextBest,
                        secondChanceUsed = true,
                        extraLivesTotal = extraLivesTotal,
                        extraLivesUsed = nextExtraLivesUsed,
                        streakIncrement = state.streakIncrement + step,
                        tickets = finalTickets,
                        ticketsShuffledAbove999 = state.ticketsShuffledAbove999 || shouldShuffle
                    ),
                    outcome = TicketRevealOutcome.BEIGE,
                    shuffled = shouldShuffle
                )
            }

            val updatedTickets = state.tickets.mapIndexed { idx, item ->
                if (idx == ticketIndex) item.copy(isRevealed = true) else item
            }
            var finalScore = clampRouletteScore(state.score)
            var dailyStreakApplied = state.dailyStreakApplied
            if (activeUpgrades.contains(RouletteUpgradeId.DAILY_STREAK)) {
                val todayKey = formatLocalDayKey()
                if (getLastDailyStreakDateStr(context) != todayKey) {
                    saveLastDailyStreakDateStr(todayKey, context)
                    finalScore = clampRouletteScore(state.score * 2)
                    dailyStreakApplied = true
                }
            }
            val nextBest = saveBestScoreIfHigher(max(state.bestScore, finalScore), context)
            val nextPowerPoints = if (state.powerPointsAwarded) {
                state.powerPoints
            } else {
                addPowerPoints(finalScore, context)
            }
            return RouletteRevealResult(
                nextState = state.copy(
                    score = finalScore,
                    bestScore = nextBest,
                    powerPoints = nextPowerPoints,
                    dailyStreakApplied = dailyStreakApplied,
                    powerPointsAwarded = true,
                    screen = RouletteScreenMode.FADING_TO_BLACK,
                    tickets = updatedTickets
                ),
                outcome = TicketRevealOutcome.RED,
                shuffled = false
            )
        }

        val updatedTickets = state.tickets.mapIndexed { idx, item ->
            if (idx == ticketIndex) item.copy(isRevealed = true) else item
        }
        val nextScore = clampRouletteScore(state.score + state.streakIncrement)
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, nextScore), context)
        val shouldShuffle = nextScore > SCORE_SHUFFLE_THRESHOLD && !state.ticketsShuffledAbove999
        val finalTickets = if (shouldShuffle) shuffleTicketPlaces(updatedTickets) else updatedTickets
        return RouletteRevealResult(
            nextState = state.copy(
                score = nextScore,
                bestScore = nextBest,
                streakIncrement = state.streakIncrement + step,
                tickets = finalTickets,
                ticketsShuffledAbove999 = state.ticketsShuffledAbove999 || shouldShuffle
            ),
            outcome = TicketRevealOutcome.BEIGE,
            shuffled = shouldShuffle
        )
    }

    fun completeFadeToGameOver(state: RouletteStateModel, context: Context? = null): RouletteStateModel {
        val clampedScore = clampRouletteScore(state.score)
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, clampedScore), context)
        val nextPowerPoints = if (state.powerPointsAwarded) {
            state.powerPoints
        } else {
            addPowerPoints(clampedScore, context)
        }
        return state.copy(
            score = clampedScore,
            bestScore = nextBest,
            powerPoints = nextPowerPoints,
            powerPointsAwarded = true,
            screen = RouletteScreenMode.GAME_OVER
        )
    }

    fun openPowerShop(state: RouletteStateModel, context: Context? = null): RouletteStateModel {
        return state.copy(
            screen = RouletteScreenMode.SHOP,
            powerPoints = getSavedPowerPoints(context),
            purchasedUpgrades = getPurchasedUpgrades(context),
            depositCount = getDepositCount(context),
            payoutDateMs = getRecordedPayoutDateMs(context),
            depositFinMonLocked = isDepositFinMonLocked(context)
        )
    }

    fun closePowerShop(state: RouletteStateModel, context: Context? = null): RouletteStateModel {
        return state.copy(
            screen = RouletteScreenMode.START,
            powerPoints = getSavedPowerPoints(context),
            purchasedUpgrades = getPurchasedUpgrades(context),
            depositCount = getDepositCount(context),
            payoutDateMs = getRecordedPayoutDateMs(context),
            depositFinMonLocked = isDepositFinMonLocked(context)
        )
    }

    fun purchaseUpgrade(
        state: RouletteStateModel,
        upgradeId: RouletteUpgradeId,
        context: Context? = null,
        nowMs: Long = System.currentTimeMillis()
    ): RoulettePurchaseResult {
        val def = UPGRADES.find { it.id == upgradeId }
            ?: return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)

        val currentUpgrades = state.purchasedUpgrades.ifEmpty { getPurchasedUpgrades(context) }

        // Repeatable "Deposit Power Points (100)" upgrade
        if (def.isRepeatable && upgradeId == RouletteUpgradeId.DEPOSIT_POWER_POINTS) {
            val finMonLocked = state.depositFinMonLocked || isDepositFinMonLocked(context)
            if (finMonLocked) {
                return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
            }
            val currentPoints = max(state.powerPoints, getSavedPowerPoints(context))
            if (currentPoints < def.cost) {
                return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
            }
            val nextPoints = savePowerPoints(currentPoints - def.cost, context)
            val prevCount = getDepositCount(context)
            val nextCount = saveDepositCount(prevCount + 1, context)
            if (prevCount == 0 || getDepositBaseTimestampMs(context) <= 0L) {
                saveDepositBaseTimestampMs(nowMs, context)
            }
            val payoutDateMs = if (getRecordedPayoutDateMs(context) > 0L) {
                getRecordedPayoutDateMs(context)
            } else {
                saveRecordedPayoutDateMs(nowMs, context)
            }
            val nextUpgrades = if (currentUpgrades.contains(upgradeId)) {
                currentUpgrades
            } else {
                savePurchasedUpgrades(currentUpgrades + upgradeId, context)
            }
            return RoulettePurchaseResult(
                nextState = state.copy(
                    powerPoints = nextPoints,
                    purchasedUpgrades = nextUpgrades,
                    depositCount = nextCount,
                    payoutDateMs = payoutDateMs,
                    depositFinMonLocked = false
                ),
                purchased = true,
                triggerBlackCatNotification = false
            )
        }

        if (def.isToggleable) {
            val currentPoints = max(state.powerPoints, getSavedPowerPoints(context))
            if (currentPoints < def.cost) {
                return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
            }
            val nextPoints = savePowerPoints(currentPoints - def.cost, context)
            val isCurrentlyActive = currentUpgrades.contains(upgradeId)
            val nextUpgrades = if (isCurrentlyActive) {
                savePurchasedUpgrades(currentUpgrades - upgradeId, context)
            } else {
                savePurchasedUpgrades(currentUpgrades + upgradeId, context)
            }
            return RoulettePurchaseResult(
                nextState = state.copy(
                    powerPoints = nextPoints,
                    purchasedUpgrades = nextUpgrades,
                    streakIncrement = getStreakStep(nextUpgrades)
                ),
                purchased = true,
                triggerBlackCatNotification = false
            )
        }

        if (def.requiredMilestone > 0 && !isMilestoneReached(def.requiredMilestone, context)) {
            return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
        }

        if (currentUpgrades.contains(upgradeId)) {
            return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
        }

        val currentPoints = max(state.powerPoints, getSavedPowerPoints(context))
        if (currentPoints < def.cost) {
            return RoulettePurchaseResult(state, purchased = false, triggerBlackCatNotification = false)
        }

        val nextPoints = savePowerPoints(currentPoints - def.cost, context)
        val nextUpgrades = savePurchasedUpgrades(currentUpgrades + upgradeId, context)

        return RoulettePurchaseResult(
            nextState = state.copy(
                powerPoints = nextPoints,
                purchasedUpgrades = nextUpgrades,
                extraLivesTotal = getExtraLivesCount(nextUpgrades)
            ),
            purchased = true,
            triggerBlackCatNotification = upgradeId == RouletteUpgradeId.BLACK_CAT
        )
    }

    fun buildBlackCatNotification(
        now: LocalTime = LocalTime.now(KYIV_ZONE),
        queue: String = "1.1",
        lang: String = "uk"
    ): Pair<String, String> {
        val currentStr = now.format(DateTimeFormatter.ofPattern("HH:mm"))
        val period = "$currentStr-23:00"
        return if (lang == "en") {
            Pair("Blackout Warning", "Queue $queue: power outage $period (until 23:00).")
        } else {
            Pair("Попередження про відключення", "Черга $queue: відключення $period (до 23:00).")
        }
    }

    /**
     * Refreshing tickets on field costs incrementally more, deducting from Player score,
     * starting from 0 first time, -1, -2, -3 and so on. Score cannot drop below 0.
     * Disabled if user doesn't have enough points to use it.
     */
    fun applyGetNewTickets(
        state: RouletteStateModel,
        queueId: String,
        isOfflineRandomized: Boolean,
        newTickets: List<RouletteTicketItem>,
        context: Context? = null
    ): RouletteStateModel {
        val currentCost = state.refreshCount.coerceAtLeast(0)
        if (!canRefreshTickets(state.score, currentCost)) {
            return state
        }
        val clampedScore = clampRouletteScore(state.score - currentCost)
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, state.score), context)
        val upgrades = state.purchasedUpgrades.ifEmpty { getPurchasedUpgrades(context) }
        val step = getStreakStep(upgrades)
        val preparedTickets = normalizeTicketsForGame(newTickets, upgrades)
        val shouldShuffle = clampedScore > SCORE_SHUFFLE_THRESHOLD
        val finalTickets = if (shouldShuffle) shuffleTicketPlaces(preparedTickets) else preparedTickets
        return state.copy(
            screen = RouletteScreenMode.PLAYING,
            score = clampedScore,
            bestScore = nextBest,
            streakIncrement = step, // Resets streak increment back to base (+1 or +2 in Nocturnal mode)
            refreshCount = state.refreshCount + 1, // Next refresh costs 1 more
            queueId = queueId,
            isOfflineRandomized = isOfflineRandomized,
            tickets = finalTickets,
            generationId = state.generationId + 1,
            ticketsShuffledAbove999 = shouldShuffle
        )
    }

    /**
     * Restart from Game Over screen: bypasses Game Start screen and starts a new game immediately (`PLAYING`).
     */
    fun applyGameOverRestart(
        state: RouletteStateModel,
        queueId: String = state.queueId,
        isOfflineRandomized: Boolean = state.isOfflineRandomized,
        newTickets: List<RouletteTicketItem> = state.tickets,
        context: Context? = null
    ): RouletteStateModel {
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, state.score), context)
        val upgrades = state.purchasedUpgrades.ifEmpty { getPurchasedUpgrades(context) }
        return startGame(
            queueId = queueId,
            isOfflineRandomized = isOfflineRandomized,
            tickets = newTickets,
            prevGenerationId = state.generationId,
            prevBestScore = nextBest,
            explicitUpgrades = upgrades,
            context = context
        )
    }

    /**
     * Main Menu button on Game Over Screen: returns to Game Start Screen (`START`).
     */
    fun applyReturnToMainMenu(state: RouletteStateModel, context: Context? = null): RouletteStateModel {
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, state.score), context)
        val upgrades = getPurchasedUpgrades(context)
        return state.copy(
            screen = RouletteScreenMode.START,
            score = 0,
            bestScore = nextBest,
            powerPoints = getSavedPowerPoints(context),
            purchasedUpgrades = upgrades,
            depositCount = getDepositCount(context),
            payoutDateMs = getRecordedPayoutDateMs(context),
            depositFinMonLocked = isDepositFinMonLocked(context),
            secondChanceUsed = false,
            extraLivesTotal = getExtraLivesCount(upgrades),
            extraLivesUsed = 0,
            dailyStreakApplied = false,
            powerPointsAwarded = false,
            streakIncrement = getStreakStep(upgrades),
            refreshCount = 0,
            tickets = state.tickets.map { it.copy(isRevealed = false) }
        )
    }

    /**
     * Close Game: resets screen to START so next time Game is started it opens from Game Start Screen.
     */
    fun applyCloseGame(
        state: RouletteStateModel,
        context: Context? = null,
        nowMs: Long = System.currentTimeMillis()
    ): RouletteStateModel {
        val payoutRes = processGameLaunchDepositPayout(nowMs, context)
        val next = applyReturnToMainMenu(state, context)
        return next.copy(
            powerPoints = payoutRes.powerPoints,
            depositCount = payoutRes.depositCount,
            payoutDateMs = payoutRes.payoutDateMs,
            depositFinMonLocked = payoutRes.depositFinMonLocked
        )
    }

    /**
     * Restart Game:
     * - If called from GAME_OVER screen, bypasses Game Start screen and starts a new game immediately (`PLAYING`).
     * - If called from PLAYING screen, adds current Score to accumulated Power Points, returns to Game Start screen (`START`), and resets score to 0.
     */
    fun applyRestartGame(
        state: RouletteStateModel,
        newTickets: List<RouletteTicketItem>? = null,
        context: Context? = null
    ): RouletteStateModel {
        val nextBest = saveBestScoreIfHigher(max(state.bestScore, state.score), context)
        if (state.screen == RouletteScreenMode.GAME_OVER) {
            return applyGameOverRestart(
                state = state.copy(bestScore = nextBest),
                newTickets = newTickets ?: state.tickets,
                context = context
            )
        }
        val nextPowerPoints = if (!state.powerPointsAwarded && state.score > 0) {
            addPowerPoints(state.score, context)
        } else {
            getSavedPowerPoints(context)
        }
        val upgrades = getPurchasedUpgrades(context)
        return state.copy(
            screen = RouletteScreenMode.START,
            score = 0,
            bestScore = nextBest,
            powerPoints = nextPowerPoints,
            purchasedUpgrades = upgrades,
            depositCount = getDepositCount(context),
            payoutDateMs = getRecordedPayoutDateMs(context),
            depositFinMonLocked = isDepositFinMonLocked(context),
            secondChanceUsed = false,
            extraLivesTotal = getExtraLivesCount(upgrades),
            extraLivesUsed = 0,
            dailyStreakApplied = false,
            powerPointsAwarded = false,
            streakIncrement = getStreakStep(upgrades),
            refreshCount = 0,
            tickets = (newTickets ?: state.tickets).map { it.copy(isRevealed = false) },
            generationId = state.generationId + 1
        )
    }

    /**
     * Renders the Share Card into an Android Bitmap (600x800) with:
     * 1. Unmodified Application icon (#FF5E3A rounded box + white lightning bolt) and name ("Світло в Житомирі")
     * 2. Game logo from Game Start Screen (glowing intact lightbulb contour)
     * 3. Game name ("Zhytomyr Roulette")
     * 4. Top Score and Power Points bars
     * 5. Bottom centered upgrade outline glyphs (grey #6B7280 or golden #F59E0B)
     */
    fun renderShareCardBitmap(
        bestScore: Int,
        powerPoints: Int,
        lang: String,
        purchasedUpgrades: Set<RouletteUpgradeId>,
        depositCount: Int
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(600, 800, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)

        // 1. Solid dark card background & golden border
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#070A10")
        canvas.drawRect(0f, 0f, 600f, 800f, paint)

        paint.style = android.graphics.Paint.Style.STROKE
        paint.strokeWidth = 3f
        paint.color = android.graphics.Color.parseColor("#D8B467")
        canvas.drawRoundRect(RectF(18f, 18f, 582f, 782f), 28f, 28f, paint)

        // 2. Application Icon (#FF5E3A rounded square + white lightning bolt) & Name ("Світло в Житомирі")
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#FF5E3A")
        canvas.drawRoundRect(RectF(145f, 48f, 193f, 96f), 12f, 12f, paint)

        val boltPath = android.graphics.Path().apply {
            moveTo(172f, 56f)
            lineTo(157f, 74f)
            lineTo(168f, 74f)
            lineTo(165f, 88f)
            lineTo(181f, 69f)
            lineTo(170f, 69f)
            close()
        }
        paint.color = android.graphics.Color.WHITE
        canvas.drawPath(boltPath, paint)

        paint.color = android.graphics.Color.WHITE
        paint.textSize = 24f
        paint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        paint.textAlign = android.graphics.Paint.Align.LEFT
        canvas.drawText("Світло в Житомирі", 208f, 80f, paint)

        // 3. Game Logo (Lightbulb contour with inner filament & screw base)
        paint.style = android.graphics.Paint.Style.STROKE
        paint.strokeWidth = 4.5f
        paint.strokeCap = android.graphics.Paint.Cap.ROUND
        paint.strokeJoin = android.graphics.Paint.Join.ROUND
        paint.color = android.graphics.Color.parseColor("#F4D06F")
        canvas.drawCircle(300f, 232f, 64f, paint)
        val filamentPath = android.graphics.Path().apply {
            moveTo(282f, 294f)
            lineTo(282f, 250f)
            lineTo(268f, 222f)
            lineTo(300f, 237f)
            lineTo(332f, 222f)
            lineTo(318f, 250f)
            lineTo(318f, 294f)
        }
        canvas.drawPath(filamentPath, paint)
        for (row in 0..3) {
            val y = 304f + row * 14f
            val halfW = 28f - row * 4f
            canvas.drawLine(300f - halfW, y, 300f + halfW, y, paint)
        }

        // 4. Game Name ("Zhytomyr Roulette")
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.WHITE
        paint.textSize = 40f
        paint.textAlign = android.graphics.Paint.Align.CENTER
        canvas.drawText("Zhytomyr Roulette", 300f, 446f, paint)

        // 5. Top Score Bar
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#141A29")
        canvas.drawRoundRect(RectF(75f, 520f, 525f, 588f), 34f, 34f, paint)
        paint.style = android.graphics.Paint.Style.STROKE
        paint.strokeWidth = 2f
        paint.color = android.graphics.Color.parseColor("#D8B467")
        canvas.drawRoundRect(RectF(75f, 520f, 525f, 588f), 34f, 34f, paint)

        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#E5D5B5")
        paint.textSize = 20f
        paint.textAlign = android.graphics.Paint.Align.LEFT
        canvas.drawText("${AppStrings.rouletteAllTimeBestScoreLabel(lang).uppercase()}:", 108f, 561f, paint)

        paint.color = android.graphics.Color.parseColor("#F5D061")
        paint.textSize = 28f
        paint.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        paint.textAlign = android.graphics.Paint.Align.RIGHT
        canvas.drawText("$bestScore", 492f, 563f, paint)

        // 6. Power Points Bar
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#141A29")
        canvas.drawRoundRect(RectF(75f, 608f, 525f, 676f), 34f, 34f, paint)
        paint.style = android.graphics.Paint.Style.STROKE
        paint.strokeWidth = 2f
        paint.color = android.graphics.Color.parseColor("#D8B467")
        canvas.drawRoundRect(RectF(75f, 608f, 525f, 676f), 34f, 34f, paint)

        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.parseColor("#E5D5B5")
        paint.textSize = 20f
        paint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        paint.textAlign = android.graphics.Paint.Align.LEFT
        canvas.drawText("${AppStrings.roulettePowerPointsLabel(lang).uppercase()}:", 108f, 649f, paint)

        paint.color = android.graphics.Color.parseColor("#F5D061")
        paint.textSize = 28f
        paint.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        paint.textAlign = android.graphics.Paint.Align.RIGHT
        canvas.drawText("$powerPoints", 492f, 651f, paint)

        // 7. Bottom Centered Upgrade Glyphs (strictly #6B7280 or #F59E0B outline strokes)
        val glyphs = getShareCardUpgradeGlyphStates(purchasedUpgrades, depositCount)
        val glyphSpacing = 48f
        val startX = 300f - ((glyphs.size - 1) * glyphSpacing) / 2f
        val cy = 736f
        for ((idx, g) in glyphs.withIndex()) {
            val cx = startX + idx * glyphSpacing
            paint.style = android.graphics.Paint.Style.STROKE
            paint.strokeWidth = 2.2f
            paint.color = android.graphics.Color.parseColor(g.colorHex)
            when (g.kind) {
                "x2" -> {
                    canvas.drawRoundRect(RectF(cx - 15f, cy - 11f, cx + 15f, cy + 11f), 5f, 5f, paint)
                    paint.style = android.graphics.Paint.Style.FILL
                    paint.textSize = 12f
                    paint.textAlign = android.graphics.Paint.Align.CENTER
                    canvas.drawText("X2", cx, cy + 4f, paint)
                }
                "person" -> {
                    canvas.drawCircle(cx, cy - 5f, 4.5f, paint)
                    canvas.drawArc(RectF(cx - 8f, cy + 1f, cx + 8f, cy + 17f), 180f, 180f, false, paint)
                }
                "heart" -> {
                    val heartP = android.graphics.Path().apply {
                        moveTo(cx, cy + 9f)
                        lineTo(cx - 8f, cy + 1f)
                        cubicTo(cx - 12f, cy - 3f, cx - 9f, cy - 9f, cx - 4f, cy - 9f)
                        cubicTo(cx - 1f, cy - 9f, cx, cy - 6f, cx, cy - 6f)
                        cubicTo(cx, cy - 6f, cx + 1f, cy - 9f, cx + 4f, cy - 9f)
                        cubicTo(cx + 9f, cy - 9f, cx + 12f, cy - 3f, cx + 8f, cy + 1f)
                        close()
                    }
                    canvas.drawPath(heartP, paint)
                }
                "flower" -> {
                    canvas.drawCircle(cx, cy, 2.5f, paint)
                    canvas.drawCircle(cx, cy - 6.5f, 3.2f, paint)
                    canvas.drawCircle(cx + 6.5f, cy, 3.2f, paint)
                    canvas.drawCircle(cx, cy + 6.5f, 3.2f, paint)
                    canvas.drawCircle(cx - 6.5f, cy, 3.2f, paint)
                }
                "cat" -> {
                    val catP = android.graphics.Path().apply {
                        moveTo(cx - 9f, cy + 3f)
                        lineTo(cx - 9f, cy - 9f)
                        lineTo(cx - 3f, cy - 4f)
                        lineTo(cx + 3f, cy - 4f)
                        lineTo(cx + 9f, cy - 9f)
                        lineTo(cx + 9f, cy + 3f)
                        cubicTo(cx + 9f, cy + 10f, cx - 9f, cy + 10f, cx - 9f, cy + 3f)
                        close()
                    }
                    canvas.drawPath(catP, paint)
                }
                "bat" -> {
                    val batP = android.graphics.Path().apply {
                        moveTo(cx - 12f, cy - 1f)
                        lineTo(cx - 6f, cy - 7f)
                        lineTo(cx - 2f, cy - 2f)
                        lineTo(cx, cy - 5f)
                        lineTo(cx + 2f, cy - 2f)
                        lineTo(cx + 6f, cy - 7f)
                        lineTo(cx + 12f, cy - 1f)
                        lineTo(cx + 6f, cy + 6f)
                        lineTo(cx, cy + 2f)
                        lineTo(cx - 6f, cy + 6f)
                        close()
                    }
                    canvas.drawPath(batP, paint)
                }
                "deposit" -> {
                    canvas.drawRoundRect(RectF(cx - 18f, cy - 11f, cx + 18f, cy + 11f), 6f, 6f, paint)
                    paint.style = android.graphics.Paint.Style.FILL
                    paint.textSize = 11f
                    paint.textAlign = android.graphics.Paint.Align.CENTER
                    canvas.drawText("${g.depositPoints}", cx, cy + 4f, paint)
                }
                else -> {
                    canvas.drawCircle(cx, cy, 9f, paint)
                }
            }
        }

        return bitmap
    }

    /**
     * Saves the rendered Share Card PNG image into Android MediaStore (Pictures/ZhytomyrRoulette)
     * and returns the saved image Uri, or null if saving failed.
     */
    fun saveShareCardBitmapToMediaStore(
        context: Context,
        bestScore: Int,
        powerPoints: Int,
        lang: String,
        purchasedUpgrades: Set<RouletteUpgradeId>,
        depositCount: Int
    ): Uri? {
        return try {
            val bitmap = renderShareCardBitmap(
                bestScore = bestScore,
                powerPoints = powerPoints,
                lang = lang,
                purchasedUpgrades = purchasedUpgrades,
                depositCount = depositCount
            )
            val filename = "zhytomyr_roulette_${System.currentTimeMillis()}.png"
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/ZhytomyrRoulette")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null
            resolver.openOutputStream(uri)?.use { outStream ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, outStream)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }
            uri
        } catch (_: Exception) {
            null
        }
    }
}

/**
 * Procedural PCM AudioTrack synthesizer for:
 * 1. Card deck shuffling / dealing sound when tickets are placed from top to bottom
 * 2. Scratch sound on swipe & when ticket is scratched off (-50% lower volume from 1.15 -> 0.575)
 * 3. Cash register ("Cha-ching!") sound when buying an upgrade in the Power Shop (-25% lower volume)
 * 4. Coin sound on Beige/X2/Golden ticket reveal (-25% lower volume)
 * 5. Electric buzzing sound while screen fades to black on Red ticket reveal (-25% lower volume)
 * 6. Sound of exploding lightbulb synchronized with the 2s+ shattering bulb animation (-25% lower volume)
 */
object RouletteSoundEngine {
    private const val SAMPLE_RATE = 22050
    private const val PREFS_NAME = "zt_roulette_prefs"
    private const val KEY_SOUND_ENABLED = "roulette_sound_enabled"
    private const val KEY_MUSIC_ENABLED = "roulette_music_enabled"
    const val SCRATCH_VOLUME_SCALE = 0.575
    const val SCRATCH_SFX_VOLUME_MULTIPLIER = 0.9
    const val SCRATCH_SFX_DURATION_MS = 336L
    const val COIN_VOLUME_SCALE = 0.75
    const val GAMEOVER_UPGRADE_VOLUME_SCALE = 0.60
    const val COIN_GAMEOVER_UPGRADE_VOLUME_SCALE = 0.75
    const val FLICKER_BUZZ_VOLUME_SCALE = 0.575
    const val GAME_BLACKOUT_VOLUME_SCALE = 0.575
    const val FLICKER_SFX_VOLUME_MULTIPLIER = 0.9
    const val MUSIC_VOLUME_SCALE = 0.15f
    const val MUSIC_FADE_DURATION_MS = 1200L
    const val GAME_OVER_MUSIC_FADE_IN_DELAY_MS = 2000L
    val START_SHOP_GAMEOVER_MUSIC_RES = R.raw.audio_start_shop_gameover
    val START_SHOP_2_MUSIC_RES = R.raw.audio_start_shop_2
    val START_SHOP_MUSIC_OPTIONS = listOf(START_SHOP_GAMEOVER_MUSIC_RES, START_SHOP_2_MUSIC_RES)
    val MAIN_GAME_MUSIC_RES = R.raw.audio_main_game
    val LIGHTBULB_SFX_RES = R.raw.sfx_lightbulb
    val SCRATCH_SFX_RES = R.raw.sfx_scratch
    val CASH_REGISTER_SFX_RES = R.raw.sfx_cash_register
    val FLICKER_SFX_RES = R.raw.sfx_flicker
    val COIN_SFX_RES = R.raw.sfx_coin
    val TWO_X_COIN_SFX_RES = R.raw.sfx_2x_coin
    val SHUFFLE_SFX_RES = R.raw.sfx_shuffle

    @Volatile
    private var appContextRef: Context? = null

    @Volatile
    private var inMemorySoundEnabled: Boolean = true

    @Volatile
    private var inMemoryMusicEnabled: Boolean = true

    @Volatile
    private var isAppInForegroundState: Boolean = true

    @Volatile
    private var activeMusicTrack: String = "NONE"

    @Volatile
    private var currentStartShopMusicRes: Int = START_SHOP_GAMEOVER_MUSIC_RES

    @Volatile
    private var lastRequestedScreen: RouletteScreenMode = RouletteScreenMode.START

    @Volatile
    private var isDialogCurrentlyOpen: Boolean = false

    private var startShopGameOverPlayer: MediaPlayer? = null
    private var startShopPlayerResId: Int = 0
    private var mainGamePlayer: MediaPlayer? = null
    private var startShopGameOverVol: Float = 0f
    private var mainGameVol: Float = 0f

    @Volatile
    private var fadeGenerationId: Int = 0

    @Volatile
    private var lastScratchMs = 0L

    @Volatile
    private var scratchSoundEndAtMs = 0L

    fun getRemainingScratchSoundDelayMs(nowMs: Long = System.currentTimeMillis()): Long {
        return (scratchSoundEndAtMs - nowMs).coerceAtLeast(0L)
    }

    fun isAppInForeground(): Boolean = isAppInForegroundState

    fun setAppInForeground(inForeground: Boolean, context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
        }
        isAppInForegroundState = inForeground
        if (!inForeground) {
            ++fadeGenerationId
            activeMusicTrack = "NONE"
            startShopGameOverVol = 0f
            mainGameVol = 0f
            try {
                startShopGameOverPlayer?.setVolume(0f, 0f)
                if (startShopGameOverPlayer?.isPlaying == true) {
                    startShopGameOverPlayer?.pause()
                }
            } catch (_: Exception) {}
            try {
                mainGamePlayer?.setVolume(0f, 0f)
                if (mainGamePlayer?.isPlaying == true) {
                    mainGamePlayer?.pause()
                }
            } catch (_: Exception) {}
        } else {
            syncBackgroundMusic(
                context = context ?: appContextRef,
                screen = lastRequestedScreen,
                isOpen = isDialogCurrentlyOpen,
                musicEnabled = isMusicEnabled(context)
            )
        }
        return isAppInForegroundState
    }

    fun pickRandomStartShopMusicRes(random: Random = Random.Default): Int {
        return if (random.nextBoolean()) START_SHOP_GAMEOVER_MUSIC_RES else START_SHOP_2_MUSIC_RES
    }

    fun randomizeStartShopMusicRes(random: Random = Random.Default): Int {
        currentStartShopMusicRes = pickRandomStartShopMusicRes(random)
        return currentStartShopMusicRes
    }

    fun getCurrentStartShopMusicRes(): Int = currentStartShopMusicRes

    fun isSoundEnabled(context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                if (prefs.contains(KEY_SOUND_ENABLED)) {
                    inMemorySoundEnabled = prefs.getBoolean(KEY_SOUND_ENABLED, true)
                }
            } catch (_: Exception) {
            }
        }
        return inMemorySoundEnabled
    }

    fun setSoundEnabled(enabled: Boolean, context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
        }
        inMemorySoundEnabled = enabled
        if (context != null) {
            try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_SOUND_ENABLED, enabled)
                    .apply()
            } catch (_: Exception) {
            }
        }
        return inMemorySoundEnabled
    }

    fun toggleSoundEnabled(context: Context? = null): Boolean {
        return setSoundEnabled(!isSoundEnabled(context), context)
    }

    fun isMusicEnabled(context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                if (prefs.contains(KEY_MUSIC_ENABLED)) {
                    inMemoryMusicEnabled = prefs.getBoolean(KEY_MUSIC_ENABLED, true)
                }
            } catch (_: Exception) {
            }
        }
        return inMemoryMusicEnabled
    }

    fun setMusicEnabled(enabled: Boolean, context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
        }
        inMemoryMusicEnabled = enabled
        if (context != null) {
            try {
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(KEY_MUSIC_ENABLED, enabled)
                    .apply()
            } catch (_: Exception) {
            }
        }
        syncBackgroundMusic(context ?: appContextRef, lastRequestedScreen, isDialogCurrentlyOpen, enabled)
        return inMemoryMusicEnabled
    }

    fun toggleMusicEnabled(context: Context? = null): Boolean {
        return setMusicEnabled(!isMusicEnabled(context), context)
    }

    fun getTargetMusicTrackForScreen(screen: RouletteScreenMode, isOpen: Boolean = true): String {
        if (!isOpen) return "NONE"
        return if (screen == RouletteScreenMode.PLAYING || screen == RouletteScreenMode.FADING_TO_BLACK) {
            "MAIN_GAME"
        } else {
            "START_SHOP_GAMEOVER"
        }
    }

    fun getActiveMusicTrack(): String = activeMusicTrack

    fun syncBackgroundMusic(
        context: Context?,
        screen: RouletteScreenMode,
        isOpen: Boolean,
        musicEnabled: Boolean = isMusicEnabled(context),
        random: Random = Random.Default
    ): String {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
        }
        val prevScreen = lastRequestedScreen
        val prevOpen = isDialogCurrentlyOpen
        lastRequestedScreen = screen
        isDialogCurrentlyOpen = isOpen

        if (isOpen && screen == RouletteScreenMode.START &&
            (!prevOpen || (prevScreen != RouletteScreenMode.START && prevScreen != RouletteScreenMode.SHOP))
        ) {
            randomizeStartShopMusicRes(random)
        }

        val desiredTrack = if (musicEnabled && isAppInForegroundState) {
            getTargetMusicTrackForScreen(screen, isOpen)
        } else {
            "NONE"
        }
        activeMusicTrack = desiredTrack

        if (!isAppInForegroundState) {
            ++fadeGenerationId
            startShopGameOverVol = 0f
            mainGameVol = 0f
            try {
                startShopGameOverPlayer?.setVolume(0f, 0f)
                if (startShopGameOverPlayer?.isPlaying == true) {
                    startShopGameOverPlayer?.pause()
                }
            } catch (_: Exception) {}
            try {
                mainGamePlayer?.setVolume(0f, 0f)
                if (mainGamePlayer?.isPlaying == true) {
                    mainGamePlayer?.pause()
                }
            } catch (_: Exception) {}
            return desiredTrack
        }

        if (context == null) {
            return desiredTrack
        }

        val currentFadeGen = ++fadeGenerationId
        val targetStartShopVol = if (desiredTrack == "START_SHOP_GAMEOVER") MUSIC_VOLUME_SCALE else 0f
        val targetMainGameVol = if (desiredTrack == "MAIN_GAME") MUSIC_VOLUME_SCALE else 0f
        val desiredStartShopRes = currentStartShopMusicRes
        val isGameOverDelay = desiredTrack == "START_SHOP_GAMEOVER" && screen == RouletteScreenMode.GAME_OVER

        Thread {
            try {
                val appCtx = context.applicationContext ?: context
                if (targetStartShopVol > 0f && (startShopGameOverPlayer == null || startShopPlayerResId != desiredStartShopRes)) {
                    try {
                        startShopGameOverPlayer?.stop()
                    } catch (_: Exception) {}
                    try {
                        startShopGameOverPlayer?.release()
                    } catch (_: Exception) {}
                    startShopGameOverVol = 0f
                    startShopPlayerResId = desiredStartShopRes
                    startShopGameOverPlayer = MediaPlayer.create(appCtx, desiredStartShopRes)?.apply {
                        isLooping = true
                        setVolume(0f, 0f)
                    }
                }
                if (targetMainGameVol > 0f && mainGamePlayer == null) {
                    mainGamePlayer = MediaPlayer.create(appCtx, MAIN_GAME_MUSIC_RES)?.apply {
                        isLooping = true
                        setVolume(0f, 0f)
                    }
                }

                // On Game Over screen: fade out main game music first and wait 2 seconds before fading in Game Over music
                if (isGameOverDelay) {
                    val stepsOut = 20
                    val stepOutDelayMs = (MUSIC_FADE_DURATION_MS / stepsOut).coerceAtLeast(15L)
                    val initialMain = mainGameVol
                    for (step in 1..stepsOut) {
                        if (fadeGenerationId != currentFadeGen || !isAppInForegroundState) return@Thread
                        val progress = step.toFloat() / stepsOut.toFloat()
                        mainGameVol = (initialMain * (1f - progress)).coerceIn(0f, MUSIC_VOLUME_SCALE)
                        try {
                            mainGamePlayer?.setVolume(mainGameVol, mainGameVol)
                        } catch (_: Exception) {}
                        Thread.sleep(stepOutDelayMs)
                    }
                    if (mainGamePlayer?.isPlaying == true) {
                        try {
                            mainGamePlayer?.pause()
                        } catch (_: Exception) {}
                    }
                    val remainingDelayMs = (GAME_OVER_MUSIC_FADE_IN_DELAY_MS - MUSIC_FADE_DURATION_MS).coerceAtLeast(0L)
                    if (remainingDelayMs > 0L) {
                        Thread.sleep(remainingDelayMs)
                    }
                    if (fadeGenerationId != currentFadeGen || !isAppInForegroundState) return@Thread
                }

                if (targetStartShopVol > 0f && startShopGameOverPlayer?.isPlaying == false && isAppInForegroundState) {
                    startShopGameOverPlayer?.setVolume(startShopGameOverVol, startShopGameOverVol)
                    startShopGameOverPlayer?.start()
                }
                if (targetMainGameVol > 0f && mainGamePlayer?.isPlaying == false && isAppInForegroundState) {
                    mainGamePlayer?.setVolume(mainGameVol, mainGameVol)
                    mainGamePlayer?.start()
                }

                val steps = 30
                val stepDelayMs = (MUSIC_FADE_DURATION_MS / steps).coerceAtLeast(15L)
                val initialStartShopVol = startShopGameOverVol
                val initialMainGameVol = mainGameVol

                for (step in 1..steps) {
                    if (fadeGenerationId != currentFadeGen || !isAppInForegroundState) return@Thread
                    val progress = step.toFloat() / steps.toFloat()
                    startShopGameOverVol = (initialStartShopVol + (targetStartShopVol - initialStartShopVol) * progress)
                        .coerceIn(0f, MUSIC_VOLUME_SCALE)
                    mainGameVol = (initialMainGameVol + (targetMainGameVol - initialMainGameVol) * progress)
                        .coerceIn(0f, MUSIC_VOLUME_SCALE)

                    try {
                        startShopGameOverPlayer?.setVolume(startShopGameOverVol, startShopGameOverVol)
                    } catch (_: Exception) {}
                    try {
                        mainGamePlayer?.setVolume(mainGameVol, mainGameVol)
                    } catch (_: Exception) {}

                    Thread.sleep(stepDelayMs)
                }

                if (fadeGenerationId == currentFadeGen) {
                    if (targetStartShopVol <= 0.001f && startShopGameOverPlayer?.isPlaying == true) {
                        try {
                            startShopGameOverPlayer?.pause()
                        } catch (_: Exception) {}
                    }
                    if (targetMainGameVol <= 0.001f && mainGamePlayer?.isPlaying == true) {
                        try {
                            mainGamePlayer?.pause()
                        } catch (_: Exception) {}
                    }
                }
            } catch (_: Exception) {
            }
        }.start()

        return desiredTrack
    }

    private fun playRawSfx(resId: Int, volume: Float, context: Context? = null): Boolean {
        if (context != null) {
            appContextRef = context.applicationContext ?: context
        }
        if (!isSoundEnabled() || !isAppInForegroundState) return false
        val ctx = context?.applicationContext ?: context ?: appContextRef ?: return false
        val clampedVol = volume.coerceIn(0f, 1f)
        Thread {
            try {
                if (!isAppInForegroundState) return@Thread
                val player = MediaPlayer.create(ctx, resId) ?: return@Thread
                player.setVolume(clampedVol, clampedVol)
                player.setOnCompletionListener { mp ->
                    try {
                        mp.release()
                    } catch (_: Exception) {}
                }
                player.setOnErrorListener { mp, _, _ ->
                    try {
                        mp.release()
                    } catch (_: Exception) {}
                    true
                }
                player.start()
            } catch (_: Exception) {}
        }.start()
        return true
    }

    private fun playPcmSamples(samples: ShortArray) {
        if (!isSoundEnabled() || !isAppInForegroundState || appContextRef == null) return
        Thread {
            var track: AudioTrack? = null
            try {
                if (!isAppInForegroundState) return@Thread
                val byteCount = samples.size * 2
                track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_GAME)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(SAMPLE_RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(max(byteCount, 2048))
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
                track.write(samples, 0, samples.size)
                if (!isAppInForegroundState) return@Thread
                track.play()
                val sleepMs = (samples.size * 1000L / SAMPLE_RATE) + 80L
                Thread.sleep(sleepMs)
            } catch (_: Exception) {
            } finally {
                try {
                    track?.stop()
                } catch (_: Exception) {}
                try {
                    track?.release()
                } catch (_: Exception) {}
            }
        }.start()
    }

    fun playCardShuffleSound(context: Context? = null) {
        if (playRawSfx(SHUFFLE_SFX_RES, 0.72f, context)) return
        val totalDurationSec = 0.52
        val count = (SAMPLE_RATE * totalDurationSec).toInt()
        val samples = ShortArray(count)
        val snapCount = 14
        val snapSpacingSamples = count / snapCount
        val snapLengthSamples = (SAMPLE_RATE * 0.026).toInt()

        for (k in 0 until snapCount) {
            val startIdx = k * snapSpacingSamples
            val carrierFreq = 1450.0 + (k % 5) * 210.0
            for (j in 0 until snapLengthSamples) {
                val idx = startIdx + j
                if (idx >= count) break
                val progress = j.toDouble() / snapLengthSamples
                val env = sin(progress * PI) * (1.0 - progress).pow(1.2)
                val wave = (Random.nextDouble(-1.0, 1.0) * 0.72 + sin(2.0 * PI * carrierFreq * j / SAMPLE_RATE) * 0.28) * env * 0.34
                val existing = samples[idx].toInt()
                val added = (wave * Short.MAX_VALUE).toInt()
                samples[idx] = (existing + added).coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            }
        }
        playPcmSamples(samples)
    }

    fun playScratchSound(force: Boolean = false, context: Context? = null) {
        if (!isSoundEnabled() || !isAppInForegroundState) return
        val now = System.currentTimeMillis()
        if (!force && now - lastScratchMs < 60L) return
        lastScratchMs = now
        scratchSoundEndAtMs = now + SCRATCH_SFX_DURATION_MS
        val effectiveScratchScale = SCRATCH_VOLUME_SCALE * SCRATCH_SFX_VOLUME_MULTIPLIER
        if (playRawSfx(SCRATCH_SFX_RES, (if (force) 0.55f else 0.42f) * effectiveScratchScale.toFloat(), context)) return

        val durSec = if (force) 0.085 else 0.045
        val count = (SAMPLE_RATE * durSec).toInt()
        val samples = ShortArray(count)
        for (i in 0 until count) {
            val env = sin((i.toDouble() / count) * PI)
            val carrier = sin(2.0 * PI * 2100.0 * i / SAMPLE_RATE)
            val noise = (Random.nextDouble(-1.0, 1.0) * 0.7 + carrier * 0.3) * env * (if (force) 0.32 else 0.25) * effectiveScratchScale
            samples[i] = (noise * Short.MAX_VALUE).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        playPcmSamples(samples)
    }

    fun playCashRegisterSound(context: Context? = null) {
        if (playRawSfx(CASH_REGISTER_SFX_RES, GAMEOVER_UPGRADE_VOLUME_SCALE.toFloat(), context)) return
        val count = (SAMPLE_RATE * 0.56).toInt()
        val clackEnd = (SAMPLE_RATE * 0.065).toInt()
        val bell1Start = (SAMPLE_RATE * 0.065).toInt()
        val bell2Start = (SAMPLE_RATE * 0.145).toInt()
        val samples = ShortArray(count)

        for (i in 0 until count) {
            var signal = 0.0
            if (i < clackEnd) {
                val p = i.toDouble() / clackEnd
                signal += Random.nextDouble(-1.0, 1.0) * (1.0 - p).pow(1.6) * 0.35
            }
            if (i >= bell1Start) {
                val dt1 = (i - bell1Start).toDouble() / SAMPLE_RATE
                signal += (sin(2.0 * PI * 2093.0 * dt1) * 0.7 + sin(2.0 * PI * 4186.0 * dt1) * 0.3) * exp(-dt1 * 12.0) * 0.32
            }
            if (i >= bell2Start) {
                val dt2 = (i - bell2Start).toDouble() / SAMPLE_RATE
                signal += (sin(2.0 * PI * 2637.02 * dt2) * 0.75 + sin(2.0 * PI * 5274.04 * dt2) * 0.25) * exp(-dt2 * 7.5) * 0.36
            }
            signal *= GAMEOVER_UPGRADE_VOLUME_SCALE
            samples[i] = (signal.coerceIn(-0.95, 0.95) * Short.MAX_VALUE).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        playPcmSamples(samples)
    }

    private fun playCoinSoundImmediate(context: Context? = null) {
        if (playRawSfx(COIN_SFX_RES, COIN_VOLUME_SCALE.toFloat(), context)) return
        val count = (SAMPLE_RATE * 0.42).toInt()
        val switchIdx = (SAMPLE_RATE * 0.08).toInt()
        val samples = ShortArray(count)
        for (i in 0 until count) {
            val t = i.toDouble() / SAMPLE_RATE
            val freq = if (i < switchIdx) 987.77 else 1318.51
            val decay = exp(-t * 6.5)
            val wave = (sin(2.0 * PI * freq * t) * 0.75 + sin(2.0 * PI * freq * 2.0 * t) * 0.25) * decay * 0.35 * COIN_VOLUME_SCALE
            samples[i] = (wave * Short.MAX_VALUE).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        playPcmSamples(samples)
    }

    fun playCoinSound(context: Context? = null) {
        if (!isSoundEnabled() || !isAppInForegroundState) return
        val waitMs = getRemainingScratchSoundDelayMs()
        if (waitMs > 0L) {
            Thread {
                try {
                    Thread.sleep(waitMs)
                } catch (_: Exception) {}
                if (isSoundEnabled() && isAppInForegroundState) {
                    playCoinSoundImmediate(context)
                }
            }.start()
            return
        }
        playCoinSoundImmediate(context)
    }

    fun play2XCoinSound(context: Context? = null) {
        if (playRawSfx(TWO_X_COIN_SFX_RES, COIN_VOLUME_SCALE.toFloat(), context)) return
        playCoinSound(context)
    }

    fun playElectricBuzzSound(durationMs: Int = 750, volumeScale: Double = GAMEOVER_UPGRADE_VOLUME_SCALE, context: Context? = null) {
        val effectiveVol = volumeScale * FLICKER_SFX_VOLUME_MULTIPLIER
        if (playRawSfx(FLICKER_SFX_RES, effectiveVol.toFloat(), context)) return
        val count = (SAMPLE_RATE * (durationMs / 1000.0)).toInt()
        val samples = ShortArray(count)
        for (i in 0 until count) {
            val t = i.toDouble() / SAMPLE_RATE
            val progress = i.toDouble() / count
            val env = (1.0 - progress * 0.35)
            val hum50 = if (sin(2.0 * PI * 50.0 * t) >= 0.0) 0.5 else -0.5
            val buzz100 = 2.0 * ((t * 100.0) - floor(0.5 + t * 100.0))
            val arcCrackle = if (Random.nextDouble() > 0.88) Random.nextDouble(-0.9, 0.9) else 0.0
            val signal = (hum50 * 0.45 + buzz100 * 0.4 + arcCrackle * 0.35) * env * 0.38 * effectiveVol
            samples[i] = (signal * Short.MAX_VALUE).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        playPcmSamples(samples)
    }

    fun playFlickerBuzzSound(durationMs: Int = 550, context: Context? = null) {
        val effectiveVol = FLICKER_BUZZ_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER
        if (playRawSfx(FLICKER_SFX_RES, effectiveVol.toFloat(), context)) return
        playBulbExplosionSound(effectiveVol)
    }

    fun playBulbExplosionSound(volumeScale: Double = GAMEOVER_UPGRADE_VOLUME_SCALE, context: Context? = null) {
        val targetRes = if (volumeScale <= FLICKER_BUZZ_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER + 0.01) FLICKER_SFX_RES else LIGHTBULB_SFX_RES
        if (playRawSfx(targetRes, volumeScale.toFloat(), context)) return
        val count = (SAMPLE_RATE * 1.65).toInt()
        val samples = ShortArray(count)
        val shardFreqs = doubleArrayOf(3150.0, 4280.0, 2760.0, 5120.0, 3690.0, 4620.0, 2980.0, 3910.0)
        for (i in 0 until count) {
            val t = i.toDouble() / SAMPLE_RATE
            val popFreq = 300.0 * exp(-t * 14.0) + 40.0
            val popEnv = exp(-t * 16.0)
            val pop = sin(2.0 * PI * popFreq * t) * popEnv * 0.65

            val shatterEnv = exp(-t * 2.8)
            val shatterNoise = Random.nextDouble(-1.0, 1.0) * shatterEnv * 0.42
            var shardChime = 0.0
            for (k in shardFreqs.indices) {
                val offset = 0.05 + k * 0.16
                if (t >= offset) {
                    val dt = t - offset
                    shardChime += sin(2.0 * PI * shardFreqs[k] * dt) * exp(-dt * 14.0) * 0.12
                }
            }
            val combined = ((pop + shatterNoise + shardChime) * volumeScale).coerceIn(-0.98, 0.98)
            samples[i] = (combined * Short.MAX_VALUE).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        playPcmSamples(samples)
    }

    fun playGameBlackoutSound(context: Context? = null) {
        val effectiveVol = GAME_BLACKOUT_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER
        if (playRawSfx(FLICKER_SFX_RES, effectiveVol.toFloat(), context)) return
        playBulbExplosionSound(effectiveVol)
    }
}

private fun DrawScope.drawIntactLightbulbContour(
    center: Offset,
    radius: Float,
    strokeColor: Color
) {
    val strokeW = max(2.2f, radius * 0.095f)
    drawCircle(
        color = strokeColor,
        radius = radius * 0.66f,
        center = Offset(center.x, center.y - radius * 0.2f),
        style = Stroke(width = strokeW)
    )
    drawArc(
        color = strokeColor.copy(alpha = 0.65f),
        startAngle = 195f,
        sweepAngle = 55f,
        useCenter = false,
        topLeft = Offset(center.x - radius * 0.52f, center.y - radius * 0.72f),
        size = Size(radius * 1.04f, radius * 1.04f),
        style = Stroke(width = strokeW * 0.7f, cap = StrokeCap.Round)
    )
    val filamentPath = Path().apply {
        moveTo(center.x - radius * 0.18f, center.y + radius * 0.42f)
        lineTo(center.x - radius * 0.18f, center.y - radius * 0.02f)
        lineTo(center.x - radius * 0.32f, center.y - radius * 0.30f)
        lineTo(center.x, center.y - radius * 0.15f)
        lineTo(center.x + radius * 0.32f, center.y - radius * 0.30f)
        lineTo(center.x + radius * 0.18f, center.y - radius * 0.02f)
        lineTo(center.x + radius * 0.18f, center.y + radius * 0.42f)
    }
    drawPath(
        filamentPath,
        color = strokeColor,
        style = Stroke(width = strokeW * 0.78f, cap = StrokeCap.Round, join = StrokeJoin.Round)
    )

    for (row in 0..3) {
        val y = center.y + radius * (0.48f + row * 0.14f)
        val halfW = radius * (0.30f - row * 0.045f)
        drawLine(
            color = strokeColor,
            start = Offset(center.x - halfW, y),
            end = Offset(center.x + halfW, y),
            strokeWidth = strokeW * 0.9f,
            cap = StrokeCap.Round
        )
    }
}

private fun DrawScope.drawExplodedLightbulbContour(
    center: Offset,
    radius: Float,
    strokeColor: Color
) {
    val strokeW = max(2f, radius * 0.11f)
    val rays = 8
    for (i in 0 until rays) {
        val angle = (i * 2.0 * PI / rays).toFloat()
        val rInner = radius * 0.18f
        val rOuter = if (i % 2 == 0) radius * 0.85f else radius * 0.58f
        drawLine(
            color = strokeColor,
            start = Offset(center.x + cos(angle) * rInner, center.y - radius * 0.12f + sin(angle) * rInner),
            end = Offset(center.x + cos(angle) * rOuter, center.y - radius * 0.12f + sin(angle) * rOuter),
            strokeWidth = strokeW * 0.85f,
            cap = StrokeCap.Round
        )
    }
    drawLine(
        color = strokeColor,
        start = Offset(center.x - radius * 0.24f, center.y + radius * 0.48f),
        end = Offset(center.x - radius * 0.38f, center.y + radius * 0.02f),
        strokeWidth = strokeW,
        cap = StrokeCap.Round
    )
    drawLine(
        color = strokeColor,
        start = Offset(center.x + radius * 0.24f, center.y + radius * 0.48f),
        end = Offset(center.x + radius * 0.38f, center.y + radius * 0.02f),
        strokeWidth = strokeW,
        cap = StrokeCap.Round
    )
    for (row in 0..1) {
        val y = center.y + radius * (0.58f + row * 0.18f)
        val halfW = radius * (0.32f - row * 0.06f)
        drawLine(
            color = strokeColor,
            start = Offset(center.x - halfW, y),
            end = Offset(center.x + halfW, y),
            strokeWidth = strokeW,
            cap = StrokeCap.Round
        )
    }
}

/**
 * Multi-frame (>2.4 seconds, 60fps) exploding lightbulb animation for Game Over screen
 */
@Composable
private fun MultiFrameExplodingBulbCanvas(modifier: Modifier = Modifier) {
    var elapsedMs by remember { mutableLongStateOf(0L) }

    LaunchedEffect(Unit) {
        val startNs = withFrameNanos { it }
        while (true) {
            withFrameNanos { frameNs ->
                elapsedMs = (frameNs - startNs) / 1_000_000L
            }
        }
    }

    val explosionProgress = (elapsedMs.toFloat() / 2400f).coerceIn(0f, 1f)
    val shardSpread = 1f - (1f - explosionProgress).pow(2.6f)
    val arcFrame = (elapsedMs / 45L).toInt()
    val jitterX = sin(arcFrame * 1.9f) * 8f
    val jitterY = cos(arcFrame * 2.3f) * 6f

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val bulbCenter = Offset(w * 0.5f, h * 0.42f)
        val baseRadius = size.minDimension * 0.36f

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color(0x99FFFBEB),
                    Color(0x88F97316),
                    Color(0x55DC2626),
                    Color.Transparent
                ),
                center = bulbCenter,
                radius = baseRadius * (1.25f + shardSpread * 0.45f)
            ),
            radius = baseRadius * (1.25f + shardSpread * 0.45f),
            center = bulbCenter
        )

        drawCircle(
            color = Color(0xFFF97316).copy(alpha = (0.85f * (1f - shardSpread)).coerceIn(0f, 1f)),
            radius = baseRadius * (0.3f + shardSpread * 1.35f),
            center = bulbCenter,
            style = Stroke(width = max(1.5f, (1f - shardSpread) * 6f))
        )

        val leftArc = Path().apply {
            moveTo(bulbCenter.x, bulbCenter.y)
            lineTo(bulbCenter.x - baseRadius * 0.35f + jitterX, bulbCenter.y + baseRadius * 0.1f + jitterY)
            lineTo(bulbCenter.x - baseRadius * 0.72f - jitterY, bulbCenter.y + baseRadius * 0.28f + jitterX)
            lineTo(bulbCenter.x - baseRadius * 1.15f, bulbCenter.y + baseRadius * 0.52f)
        }
        drawPath(leftArc, color = Color(0xFFFB923C), style = Stroke(width = 4.5f, cap = StrokeCap.Round))

        val rightArc = Path().apply {
            moveTo(bulbCenter.x, bulbCenter.y)
            lineTo(bulbCenter.x + baseRadius * 0.38f - jitterX, bulbCenter.y - baseRadius * 0.12f + jitterY)
            lineTo(bulbCenter.x + baseRadius * 0.76f + jitterY, bulbCenter.y - baseRadius * 0.26f - jitterX)
            lineTo(bulbCenter.x + baseRadius * 1.18f, bulbCenter.y - baseRadius * 0.42f)
        }
        drawPath(rightArc, color = Color(0xFFFBBF24), style = Stroke(width = 4.5f, cap = StrokeCap.Round))

        val shardCount = 12
        for (i in 0 until shardCount) {
            val angle = (i * 2.0 * PI / shardCount - PI * 0.85).toFloat()
            val travel = baseRadius * (0.28f + (i % 3) * 0.16f) * (0.4f + shardSpread * 1.1f)
            val sx = bulbCenter.x + cos(angle) * travel
            val sy = bulbCenter.y + sin(angle) * travel + shardSpread * shardSpread * 18f
            val rotDeg = (i * 37f - 90f) * shardSpread

            withTransform({
                rotate(degrees = rotDeg, pivot = Offset(sx, sy))
            }) {
                val shardPath = Path().apply {
                    moveTo(sx, sy - baseRadius * 0.14f)
                    lineTo(sx + baseRadius * 0.12f, sy + baseRadius * 0.04f)
                    lineTo(sx - baseRadius * 0.04f, sy + baseRadius * 0.14f)
                    close()
                }
                drawPath(shardPath, color = Color(0x55CBD5E1))
                drawPath(shardPath, color = Color(0xFFF8FAFC), style = Stroke(width = 2.5f))
            }
        }

        val neckPath = Path().apply {
            moveTo(bulbCenter.x - baseRadius * 0.36f, bulbCenter.y + baseRadius * 0.78f)
            lineTo(bulbCenter.x - baseRadius * 0.48f, bulbCenter.y + baseRadius * 0.32f)
            lineTo(bulbCenter.x - baseRadius * 0.26f, bulbCenter.y + baseRadius * 0.42f)
            moveTo(bulbCenter.x + baseRadius * 0.36f, bulbCenter.y + baseRadius * 0.78f)
            lineTo(bulbCenter.x + baseRadius * 0.48f, bulbCenter.y + baseRadius * 0.32f)
            lineTo(bulbCenter.x + baseRadius * 0.26f, bulbCenter.y + baseRadius * 0.42f)
        }
        drawPath(neckPath, color = Color(0xFFF87171), style = Stroke(width = 4.5f, cap = StrokeCap.Round))

        for (row in 0..2) {
            val y = bulbCenter.y + baseRadius * (0.84f + row * 0.16f)
            val halfW = baseRadius * (0.34f - row * 0.05f)
            drawLine(
                color = Color(0xFF94A3B8),
                start = Offset(bulbCenter.x - halfW, y),
                end = Offset(bulbCenter.x + halfW, y),
                strokeWidth = 6f,
                cap = StrokeCap.Round
            )
        }
    }
}

private const val GRID_COLS = 20
private const val GRID_ROWS = 10
private const val TOTAL_GRID_CELLS = GRID_COLS * GRID_ROWS // 200 cells -> 20% = 40 cells

@Composable
private fun HeaderHeartIconComposable(used: Boolean, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(16.dp)) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(w * 0.5f, h * 0.88f)
            cubicTo(w * 0.1f, h * 0.62f, w * 0.05f, h * 0.25f, w * 0.28f, h * 0.15f)
            cubicTo(w * 0.42f, h * 0.10f, w * 0.5f, h * 0.22f, w * 0.5f, h * 0.28f)
            cubicTo(w * 0.5f, h * 0.22f, w * 0.58f, h * 0.10f, w * 0.72f, h * 0.15f)
            cubicTo(w * 0.95f, h * 0.25f, w * 0.9f, h * 0.62f, w * 0.5f, h * 0.88f)
            close()
        }
        val strokeColor = if (used) Color(0xFF9CA3AF) else Color(0xFFEF4444)
        if (!used) {
            drawPath(path, color = Color(0xFFEF4444))
        }
        drawPath(path, color = strokeColor, style = Stroke(width = 1.8.dp.toPx(), join = StrokeJoin.Round))
    }
}

@Composable
private fun PowerPointsMilestoneProgressBarComposable(
    accumulatedPoints: Int,
    reachedMilestones: Set<Int>
) {
    val progressFraction = ZhytomyrRouletteEngine.getMilestoneProgressFraction(accumulatedPoints)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(CircleShape)
                .background(Color(0xFF141A29))
                .border(1.dp, Color(0x73D8B467), CircleShape)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(progressFraction.coerceIn(0f, 1f))
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color(0xFFA3221C), Color(0xFFD97706), Color(0xFFF5D061))
                        )
                    )
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            for (milestone in ZhytomyrRouletteEngine.POWER_POINT_MILESTONES) {
                val isReached = reachedMilestones.contains(milestone) || accumulatedPoints >= milestone
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Outlined score pill under progress bar matching emulator
                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isReached) Color(0x3310B981) else Color(0xBF141A29))
                            .border(
                                1.dp,
                                if (isReached) Color(0xFF34D399) else Color(0x4DD8B467),
                                CircleShape
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = "$milestone",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold,
                            color = if (isReached) Color(0xFF6EE7B7) else Color(0xA6E5D5B5)
                        )
                        if (isReached) {
                            Text(
                                text = "V",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFF34D399)
                            )
                        }
                    }

                    // Upgrade Reward Icons below Milestone 400 (Daily Streak X2) and Milestone 1000 (Perseverance Heart) with identical size & outline
                    if (milestone == 400) {
                        Box(
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .size(width = 24.dp, height = 20.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isReached) Color(0x26F5D061) else Color(0x9918181B))
                                .border(
                                    1.dp,
                                    if (isReached) Color(0xFFF5D061) else Color(0xFF52525B),
                                    RoundedCornerShape(4.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "X2",
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Black,
                                color = if (isReached) Color(0xFFF5D061) else Color(0xFF71717A)
                            )
                        }
                    } else if (milestone == 1000) {
                        Box(
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .size(width = 24.dp, height = 20.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isReached) Color(0x26F5D061) else Color(0x9918181B))
                                .border(
                                    1.dp,
                                    if (isReached) Color(0xFFF5D061) else Color(0xFF52525B),
                                    RoundedCornerShape(4.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            val heartStrokeColor = if (isReached) Color(0xFFF5D061) else Color(0xFF71717A)
                            Canvas(modifier = Modifier.size(12.dp)) {
                                val w = size.width
                                val h = size.height
                                val path = Path().apply {
                                    moveTo(w * 0.5f, h * 0.88f)
                                    cubicTo(w * 0.1f, h * 0.62f, w * 0.05f, h * 0.25f, w * 0.28f, h * 0.15f)
                                    cubicTo(w * 0.42f, h * 0.10f, w * 0.5f, h * 0.22f, w * 0.5f, h * 0.28f)
                                    cubicTo(w * 0.5f, h * 0.22f, w * 0.58f, h * 0.10f, w * 0.72f, h * 0.15f)
                                    cubicTo(w * 0.95f, h * 0.25f, w * 0.9f, h * 0.62f, w * 0.5f, h * 0.88f)
                                    close()
                                }
                                drawPath(
                                    path = path,
                                    color = heartStrokeColor,
                                    style = Stroke(width = 1.6.dp.toPx(), join = StrokeJoin.Round)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShareCardUpgradeGlyphsRowComposable(
    purchasedUpgrades: Set<RouletteUpgradeId>,
    depositCount: Int
) {
    val glyphStates = remember(purchasedUpgrades, depositCount) {
        ZhytomyrRouletteEngine.getShareCardUpgradeGlyphStates(purchasedUpgrades, depositCount)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        glyphStates.forEachIndexed { idx, glyph ->
            // Strictly grey (#6B7280) if not bought or golden (#F59E0B) if bought, outline only
            val glyphColor = if (glyph.purchased) Color(0xFFF59E0B) else Color(0xFF6B7280)
            if (idx > 0) {
                Spacer(modifier = Modifier.width(6.dp))
            }
            when (glyph.kind) {
                "x2" -> {
                    Box(
                        modifier = Modifier
                            .border(1.2.dp, glyphColor, RoundedCornerShape(4.dp))
                            .padding(horizontal = 3.dp, vertical = 1.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "X2",
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold,
                            color = glyphColor
                        )
                    }
                }
                "deposit" -> {
                    Box(
                        modifier = Modifier
                            .border(1.2.dp, glyphColor, RoundedCornerShape(4.dp))
                            .padding(horizontal = 4.dp, vertical = 1.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${glyph.depositPoints}",
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.ExtraBold,
                            color = glyphColor
                        )
                    }
                }
                else -> {
                    Canvas(modifier = Modifier.size(16.dp)) {
                        val w = size.width
                        val h = size.height
                        val stroke = Stroke(width = 1.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                        when (glyph.kind) {
                            "person" -> {
                                drawCircle(
                                    color = glyphColor,
                                    radius = w * 0.22f,
                                    center = Offset(w * 0.5f, h * 0.3f),
                                    style = stroke
                                )
                                drawArc(
                                    color = glyphColor,
                                    startAngle = 180f,
                                    sweepAngle = 180f,
                                    useCenter = false,
                                    topLeft = Offset(w * 0.18f, h * 0.56f),
                                    size = Size(w * 0.64f, h * 0.55f),
                                    style = stroke
                                )
                            }
                            "heart" -> {
                                val path = Path().apply {
                                    moveTo(w * 0.5f, h * 0.86f)
                                    cubicTo(w * 0.1f, h * 0.6f, w * 0.08f, h * 0.25f, w * 0.3f, h * 0.16f)
                                    cubicTo(w * 0.42f, h * 0.1f, w * 0.5f, h * 0.22f, w * 0.5f, h * 0.28f)
                                    cubicTo(w * 0.5f, h * 0.22f, w * 0.58f, h * 0.1f, w * 0.7f, h * 0.16f)
                                    cubicTo(w * 0.92f, h * 0.25f, w * 0.9f, h * 0.6f, w * 0.5f, h * 0.86f)
                                    close()
                                }
                                drawPath(path, color = glyphColor, style = stroke)
                            }
                            "flower" -> {
                                drawCircle(color = glyphColor, radius = w * 0.14f, center = Offset(w * 0.5f, h * 0.5f), style = stroke)
                                drawCircle(color = glyphColor, radius = w * 0.14f, center = Offset(w * 0.5f, h * 0.22f), style = stroke)
                                drawCircle(color = glyphColor, radius = w * 0.14f, center = Offset(w * 0.5f, h * 0.78f), style = stroke)
                                drawCircle(color = glyphColor, radius = w * 0.14f, center = Offset(w * 0.22f, h * 0.5f), style = stroke)
                                drawCircle(color = glyphColor, radius = w * 0.14f, center = Offset(w * 0.78f, h * 0.5f), style = stroke)
                            }
                            "cat" -> {
                                val path = Path().apply {
                                    moveTo(w * 0.2f, h * 0.55f)
                                    lineTo(w * 0.2f, h * 0.18f)
                                    lineTo(w * 0.38f, h * 0.35f)
                                    lineTo(w * 0.62f, h * 0.35f)
                                    lineTo(w * 0.8f, h * 0.18f)
                                    lineTo(w * 0.8f, h * 0.55f)
                                    cubicTo(w * 0.8f, h * 0.78f, w * 0.2f, h * 0.78f, w * 0.2f, h * 0.55f)
                                    close()
                                }
                                drawPath(path, color = glyphColor, style = stroke)
                            }
                            "bat" -> {
                                val path = Path().apply {
                                    moveTo(w * 0.08f, h * 0.45f)
                                    lineTo(w * 0.28f, h * 0.25f)
                                    lineTo(w * 0.42f, h * 0.4f)
                                    lineTo(w * 0.5f, h * 0.28f)
                                    lineTo(w * 0.58f, h * 0.4f)
                                    lineTo(w * 0.72f, h * 0.25f)
                                    lineTo(w * 0.92f, h * 0.45f)
                                    lineTo(w * 0.72f, h * 0.72f)
                                    lineTo(w * 0.5f, h * 0.58f)
                                    lineTo(w * 0.28f, h * 0.72f)
                                    close()
                                }
                                drawPath(path, color = glyphColor, style = stroke)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScratchTicketComposable(
    ticket: RouletteTicketItem,
    generationId: Int,
    disabled: Boolean,
    isBlackoutActive: Boolean = false,
    foilBitmap: ImageBitmap,
    onReveal: (Int) -> Unit
) {
    val scratchPoints = remember(ticket.index, ticket.slotLabel, generationId) { mutableStateListOf<Offset>() }
    val scratchedCells = remember(ticket.index, ticket.slotLabel, generationId) { mutableSetOf<Int>() }
    var centerOutlineShown by remember(ticket.index, ticket.slotLabel, generationId) { mutableStateOf(false) }

    val markGridAndCheckReveal: (Offset, Offset, Float, Float, Float) -> Unit = { prevPos, pos, widthPx, heightPx, brushRadiusPx ->
        if (widthPx > 0f && heightPx > 0f) {
            if (!centerOutlineShown) {
                if (ZhytomyrRouletteEngine.doesScratchExposeRedCenterOutline(
                        prevPos.x,
                        prevPos.y,
                        pos.x,
                        pos.y,
                        widthPx,
                        heightPx,
                        brushRadiusPx
                    )
                ) {
                    centerOutlineShown = true
                }
            }
            val cellW = widthPx / GRID_COLS
            val cellH = heightPx / GRID_ROWS
            val rSq = (brushRadiusPx * 1.35f) * (brushRadiusPx * 1.35f)
            for (r in 0 until GRID_ROWS) {
                val cy = (r + 0.5f) * cellH
                for (c in 0 until GRID_COLS) {
                    val cellId = r * GRID_COLS + c
                    if (scratchedCells.contains(cellId)) continue
                    val cx = (c + 0.5f) * cellW
                    val dx = cx - pos.x
                    val dy = cy - pos.y
                    if (dx * dx + dy * dy <= rSq) {
                        scratchedCells.add(cellId)
                    }
                }
            }
            val fraction = scratchedCells.size.toFloat() / TOTAL_GRID_CELLS.toFloat()
            if (ZhytomyrRouletteEngine.isTicketScratchedEnough(fraction, centerOutlineShown)) {
                onReveal(ticket.index)
            }
        }
    }

    if (isBlackoutActive) {
        // During 10-second Game Blackout: only outlines of tickets are visible without text or scratching area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(74.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF04060A))
                .border(1.2.dp, Color(0x59C9A85C), RoundedCornerShape(12.dp))
        )
        return
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(74.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(1.2.dp, Color(0xA6C9A85C), RoundedCornerShape(12.dp))
            .pointerInput(ticket.index, generationId, ticket.isRevealed, disabled) {
                if (!ticket.isRevealed && !disabled) {
                    detectHorizontalDragGestures(
                        onDragStart = { startOffset ->
                            scratchPoints.add(startOffset)
                        },
                        onHorizontalDrag = { change, _ ->
                            change.consume()
                            val pos = change.position
                            val prevPos = scratchPoints.lastOrNull() ?: pos
                            scratchPoints.add(pos)
                            RouletteSoundEngine.playScratchSound(false)
                            markGridAndCheckReveal(prevPos, pos, size.width.toFloat(), size.height.toFloat(), 9.dp.toPx())
                        }
                    )
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val center = Offset(w / 2f, h / 2f)

            // 1. Underlying Ticket Base
            val isGoldenRevealed = ticket.isGolden && ticket.isRevealed
            drawRect(
                brush = Brush.verticalGradient(
                    colors = if (isGoldenRevealed) {
                        listOf(
                            Color(0xFFFDE68A),
                            Color(0xFFFFFBEB),
                            Color(0xFFF59E0B)
                        )
                    } else {
                        listOf(
                            Color(0xFFD8D6CC),
                            Color(0xFFFCFBF7),
                            Color(0xFFCCC9BE)
                        )
                    }
                )
            )

            // 2. Center Medallion & Lightbulb / X2 Symbol
            if (ticket.isGolden) {
                val goldRadius = min(w, h) * 0.36f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            Color(0xB8FBBF24),
                            Color(0x66D97706),
                            Color.Transparent
                        ),
                        center = center,
                        radius = goldRadius * 1.2f
                    ),
                    radius = goldRadius * 1.2f,
                    center = center
                )
                drawIntactLightbulbContour(
                    center = center,
                    radius = min(w, h) * 0.26f,
                    strokeColor = Color(0xFF92400E)
                )
            } else if (ticket.isX2) {
                val x2Radius = min(w, h) * 0.36f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            Color(0x73F5D061),
                            Color(0x26D97706),
                            Color.Transparent
                        ),
                        center = center,
                        radius = x2Radius * 1.15f
                    ),
                    radius = x2Radius * 1.15f,
                    center = center
                )
            } else if (ticket.isRed) {
                drawExplodedLightbulbContour(
                    center = center,
                    radius = min(w, h) * 0.26f,
                    strokeColor = Color(0xFFEF4444)
                )
            } else {
                drawIntactLightbulbContour(
                    center = center,
                    radius = min(w, h) * 0.26f,
                    strokeColor = Color(0xFF25211B)
                )
            }

            // 3. Unscratched Generated Ticket Foil Image Surface
            if (!ticket.isRevealed) {
                drawContext.canvas.saveLayer(
                    androidx.compose.ui.geometry.Rect(0f, 0f, w, h),
                    androidx.compose.ui.graphics.Paint()
                )

                val placement = ticket.stainPlacement
                val srcX = (foilBitmap.width * 0.085f).toInt()
                val srcY = (foilBitmap.height * 0.085f).toInt()
                val srcW = (foilBitmap.width * 0.83f).toInt()
                val srcH = (foilBitmap.height * 0.83f).toInt()

                withTransform({
                    scale(
                        scaleX = if (placement.textureFlipX) -1f else 1f,
                        scaleY = if (placement.textureFlipY) -1f else 1f,
                        pivot = center
                    )
                }) {
                    drawImage(
                        image = foilBitmap,
                        srcOffset = IntOffset(srcX, srcY),
                        srcSize = IntSize(srcW, srcH),
                        dstOffset = IntOffset.Zero,
                        dstSize = IntSize(w.toInt(), h.toInt())
                    )
                }

                // Randomized stain placement overlay
                if (placement.stainIntensity > 0.05f) {
                    val stainCenter = Offset(w * placement.stainOffsetX, h * placement.stainOffsetY)
                    val stainRad = min(w, h) * placement.stainRadiusRatio * 1.15f
                    val alpha = (placement.stainIntensity * 0.42f).coerceIn(0f, 0.65f)
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                Color(0xFF4E2C10).copy(alpha = alpha * 0.22f),
                                Color(0xFF44240C).copy(alpha = alpha * 0.85f),
                                Color(0xFF301806).copy(alpha = alpha),
                                Color.Transparent
                            ),
                            center = stainCenter,
                            radius = stainRad
                        ),
                        radius = stainRad,
                        center = stainCenter
                    )
                }

                // Profound paper wrinkle ridges & shadow creases
                if (placement.wrinkleDepth >= 0.55f) {
                    val wAlpha = (placement.wrinkleDepth * 0.34f).coerceIn(0f, 0.5f)
                    val creaseX = w * (0.15f + placement.stainOffsetX * 0.5f)
                    val creasePath = Path().apply {
                        moveTo(creaseX, 0f)
                        lineTo(creaseX - 18f, h * 0.45f)
                        lineTo(creaseX + 12f, h)
                    }
                    drawPath(
                        path = creasePath,
                        color = Color(0xFF1C1206).copy(alpha = wAlpha),
                        style = Stroke(width = 2.4f, cap = StrokeCap.Round)
                    )
                }

                // Slightly smaller erase radius (9.dp instead of 14.dp) so scratching reveals less surface for more intrigue
                val eraseRadius = 9.dp.toPx()
                for (pt in scratchPoints) {
                    drawCircle(
                        color = Color.Transparent,
                        radius = eraseRadius,
                        center = pt,
                        blendMode = BlendMode.Clear
                    )
                }

                drawContext.canvas.restore()
            }
        }

        // Underlying X2 symbol when ticket is an X2 multiplier ticket (on Beige or Red in Nocturnal Creature mode)
        if (!ticket.isGolden && ticket.isX2 && (ticket.isRevealed || scratchPoints.isNotEmpty())) {
            Text(
                text = "X2",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = if (ticket.isRed) Color(0xFFEF4444) else Color(0xFF78350F)
            )
        }

        // Bigger Timeslot label with SansSerif Display Font
        if (!ticket.isRevealed && scratchPoints.size < 4) {
            Text(
                text = ticket.slotLabel,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                fontFamily = FontFamily.SansSerif,
                color = if (ticket.visualVariant == TicketVisualVariant.FADED) Color(0xFF2B2212) else Color(0xFF181206)
            )
        } else if (ticket.isRevealed) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 3.dp),
                contentAlignment = Alignment.BottomCenter
            ) {
                Text(
                    text = ticket.slotLabel,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.SansSerif,
                    color = Color(0xCC3D372E)
                )
            }
        }
    }
}

@Composable
fun ZhytomyrRouletteDialog(
    lang: String,
    providerUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    queue: String = "1.1",
    onShowAppBanner: ((String) -> Unit)? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scheduleRepo = remember { ScheduleRepository(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var gameState by remember { mutableStateOf(ZhytomyrRouletteEngine.createInitialState(context)) }
    var dealtRowsCount by remember { mutableIntStateOf(24) }
    var targetFlickerAlpha by remember { mutableFloatStateOf(0f) }
    var isFadeToBlackStarted by remember { mutableStateOf(false) }
    var isGameBlackoutActive by remember { mutableStateOf(false) }
    var soundEnabled by remember { mutableStateOf(RouletteSoundEngine.isSoundEnabled(context)) }
    var musicEnabled by remember { mutableStateOf(RouletteSoundEngine.isMusicEnabled(context)) }
    val ticketListState = rememberLazyListState()

    // Scroll to top ONLY when a new set of tickets is dealt (new game or Get New Tickets), NEVER when Game Over FADING_TO_BLACK is triggered
    LaunchedEffect(gameState.generationId) {
        ticketListState.scrollToItem(0)
    }

    // Synchronize background music with current screen and Music On/Off switch using smooth fade-in / fade-out at 15% volume
    LaunchedEffect(gameState.screen, musicEnabled) {
        RouletteSoundEngine.syncBackgroundMusic(
            context = context,
            screen = gameState.screen,
            isOpen = true,
            musicEnabled = musicEnabled
        )
    }

    // Mute music & sounds immediately if Application is minimized / sent to Home screen, and restore when resumed
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    RouletteSoundEngine.setAppInForeground(true, context)
                }
                Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> {
                    RouletteSoundEngine.setAppInForeground(false, context)
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            RouletteSoundEngine.syncBackgroundMusic(
                context = context,
                screen = RouletteScreenMode.START,
                isOpen = false,
                musicEnabled = false
            )
        }
    }

    // Preload the 9 generated ticket texture bitmaps
    val pristineBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_pristine)
    val wrinkledBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_wrinkled)
    val deepWrinkledBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_deep_wrinkled)
    val crumpledScratchedBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_crumpled_scratched)
    val cupStainBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_cup_stain)
    val stainCornerBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_stain_corner)
    val waterStainsBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_water_stains)
    val heavyWearBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_heavy_wear)
    val fadedBitmap = ImageBitmap.imageResource(id = R.drawable.ticket_foil_faded)

    val bitmapForVariant: (TicketVisualVariant) -> ImageBitmap = { variant ->
        when (variant) {
            TicketVisualVariant.PRISTINE -> pristineBitmap
            TicketVisualVariant.WRINKLED -> wrinkledBitmap
            TicketVisualVariant.DEEP_WRINKLED -> deepWrinkledBitmap
            TicketVisualVariant.CRUMPLED_SCRATCHED -> crumpledScratchedBitmap
            TicketVisualVariant.CUP_STAIN -> cupStainBitmap
            TicketVisualVariant.STAIN_CORNER -> stainCornerBitmap
            TicketVisualVariant.WATER_STAINS -> waterStainsBitmap
            TicketVisualVariant.HEAVY_WEAR -> heavyWearBitmap
            TicketVisualVariant.FADED -> fadedBitmap
        }
    }

    val animatedFlickerAlpha by animateFloatAsState(
        targetValue = if (gameState.screen == RouletteScreenMode.GAME_OVER) 0f else targetFlickerAlpha,
        animationSpec = tween(durationMillis = 520, easing = FastOutSlowInEasing),
        label = "rouletteSlowBrownoutFlicker"
    )

    val triggerDealAnimation: () -> Unit = {
        RouletteSoundEngine.playCardShuffleSound(context)
        dealtRowsCount = 0
        scope.launch {
            ticketListState.scrollToItem(0)
            val stepDelayMs = ZhytomyrRouletteEngine.TICKET_SHUFFLE_ANIMATION_DURATION_MS /
                ZhytomyrRouletteEngine.TICKET_SHUFFLE_ROW_COUNT
            var r = 0
            while (r < ZhytomyrRouletteEngine.TICKET_SHUFFLE_ROW_COUNT) {
                delay(stepDelayMs)
                r += 1
                dealtRowsCount = r.coerceAtMost(ZhytomyrRouletteEngine.TICKET_SHUFFLE_ROW_COUNT)
            }
        }
    }

    // Close Game handler: resets game state to START screen before closing
    val handleCloseGame: () -> Unit = {
        isFadeToBlackStarted = false
        isGameBlackoutActive = false
        gameState = ZhytomyrRouletteEngine.applyCloseGame(gameState, context)
        onDismiss()
    }

    // Slow 2-3s screen flickering every 15-30 seconds on all screens EXCEPT Game Over, only when app is in foreground (RESUMED)
    LaunchedEffect(gameState.screen, lifecycleOwner) {
        if (gameState.screen == RouletteScreenMode.GAME_OVER) {
            targetFlickerAlpha = 0f
            return@LaunchedEffect
        }
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                val waitMs = ZhytomyrRouletteEngine.getNextFlickerDelayMs()
                delay(waitMs)
                if (gameState.screen != RouletteScreenMode.GAME_OVER && RouletteSoundEngine.isAppInForeground()) {
                    val totalDurationMs = ZhytomyrRouletteEngine.getFlickerDurationMs()
                    RouletteSoundEngine.playFlickerBuzzSound(totalDurationMs.toInt())
                    targetFlickerAlpha = 0.45f
                    delay((totalDurationMs * 0.25f).toLong())
                    targetFlickerAlpha = 0.16f
                    delay((totalDurationMs * 0.27f).toLong())
                    targetFlickerAlpha = 0.55f
                    delay((totalDurationMs * 0.26f).toLong())
                    targetFlickerAlpha = 0.22f
                    delay((totalDurationMs * 0.22f).toLong())
                    targetFlickerAlpha = 0f
                }
            }
        }
    }

    // 10-second "Game Blackout" on Main Game Screen every 5–10 minutes, only when app is in foreground (RESUMED)
    LaunchedEffect(gameState.screen, lifecycleOwner) {
        if (gameState.screen != RouletteScreenMode.PLAYING) {
            isGameBlackoutActive = false
            return@LaunchedEffect
        }
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                val waitMs = ZhytomyrRouletteEngine.getNextGameBlackoutDelayMs()
                delay(waitMs)
                if (gameState.screen == RouletteScreenMode.PLAYING && RouletteSoundEngine.isAppInForeground()) {
                    isGameBlackoutActive = true
                    RouletteSoundEngine.playGameBlackoutSound()
                    delay(ZhytomyrRouletteEngine.GAME_BLACKOUT_DURATION_MS)
                    isGameBlackoutActive = false
                    RouletteSoundEngine.playFlickerBuzzSound(550)
                }
            }
        }
    }

    val startOrRefreshTickets: (Boolean) -> Unit = { isInitialStart ->
        isFadeToBlackStarted = false
        val upgrades = ZhytomyrRouletteEngine.getPurchasedUpgrades(context)
        val (queueId, isOffline, loadedTickets) =
            ZhytomyrRouletteEngine.loadCachedRandomQueueTickets(scheduleRepo, Random.Default, upgrades)
        gameState = if (isInitialStart) {
            ZhytomyrRouletteEngine.startGame(
                queueId = queueId,
                isOfflineRandomized = isOffline,
                tickets = loadedTickets,
                prevGenerationId = gameState.generationId,
                prevBestScore = max(gameState.bestScore, ZhytomyrRouletteEngine.getSavedBestScore(context)),
                explicitUpgrades = upgrades,
                context = context
            )
        } else {
            ZhytomyrRouletteEngine.applyGetNewTickets(
                state = gameState,
                queueId = queueId,
                isOfflineRandomized = isOffline,
                newTickets = loadedTickets,
                context = context
            )
        }
        triggerDealAnimation()
    }

    val handleTicketReveal: (Int) -> Unit = { ticketIndex ->
        // Scratching sound when ticket is scratched off
        RouletteSoundEngine.playScratchSound(force = true, context = context)
        val result = ZhytomyrRouletteEngine.revealTicket(gameState, ticketIndex, context)
        gameState = result.nextState
        if (result.shuffled) {
            triggerDealAnimation()
        }
        when (result.outcome) {
            TicketRevealOutcome.BEIGE -> {
                RouletteSoundEngine.playCoinSound(context)
            }
            TicketRevealOutcome.X2, TicketRevealOutcome.GOLDEN -> {
                RouletteSoundEngine.play2XCoinSound(context)
            }
            TicketRevealOutcome.RED -> {
                // 1-second realization delay to let User realize the scratching result before Game Over fade-to-black
                isFadeToBlackStarted = false
                scope.launch {
                    delay(ZhytomyrRouletteEngine.GAME_OVER_REALIZATION_DELAY_MS)
                    isFadeToBlackStarted = true
                    RouletteSoundEngine.playElectricBuzzSound(750, context = context)
                    delay(750L)
                    RouletteSoundEngine.playBulbExplosionSound(context = context)
                    isFadeToBlackStarted = false
                    gameState = ZhytomyrRouletteEngine.completeFadeToGameOver(gameState, context)
                }
            }
            TicketRevealOutcome.NONE -> {}
        }
    }

    val handlePurchaseUpgrade: (RouletteUpgradeId) -> Unit = { upgradeId ->
        val res = ZhytomyrRouletteEngine.purchaseUpgrade(gameState, upgradeId, context)
        if (res.purchased) {
            gameState = res.nextState
            RouletteSoundEngine.playCashRegisterSound()
            if (res.triggerBlackCatNotification) {
                scope.launch {
                    delay(3000L)
                    val (title, body) = ZhytomyrRouletteEngine.buildBlackCatNotification(
                        now = LocalTime.now(KYIV_ZONE),
                        queue = queue,
                        lang = lang
                    )
                    NotificationHelper.showPreWarningNotification(
                        context = context.applicationContext,
                        notificationId = 9913,
                        title = title,
                        body = body,
                        isTest = true
                    )
                    onShowAppBanner?.invoke(body)
                }
            }
        }
    }

    val fadeAlpha by animateFloatAsState(
        targetValue = if (gameState.screen == RouletteScreenMode.FADING_TO_BLACK && isFadeToBlackStarted) 1f else 0f,
        animationSpec = tween(durationMillis = 700, easing = FastOutSlowInEasing),
        label = "rouletteFadeToBlack"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF070A10))
            .pointerInput(Unit) {
                detectTapGestures { /* Consume taps on empty space so they never pass through to Main Application behind Game */ }
            }
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        val crossfadeTargetScreen = if (gameState.screen == RouletteScreenMode.FADING_TO_BLACK) {
            RouletteScreenMode.PLAYING
        } else {
            gameState.screen
        }

        Crossfade(
            targetState = crossfadeTargetScreen,
            animationSpec = tween(durationMillis = 280),
            label = "rouletteScreenCrossfade"
        ) { currentScreen ->
            when (currentScreen) {
                RouletteScreenMode.START -> {
                    val bestScoreVal = max(gameState.bestScore, ZhytomyrRouletteEngine.getSavedBestScore(context))
                    val powerPointsVal = max(gameState.powerPoints, ZhytomyrRouletteEngine.getSavedPowerPoints(context))
                    val accumulatedPointsVal = max(powerPointsVal, ZhytomyrRouletteEngine.getAccumulatedPowerPoints(context))
                    val reachedMilestonesVal = ZhytomyrRouletteEngine.getReachedMilestones(context)
                    var showSharePreview by remember { mutableStateOf(false) }

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF070A10))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 24.dp, vertical = 14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Progress bar on top of Game Start Screen counting total Power Points accumulation progress
                                PowerPointsMilestoneProgressBarComposable(
                                    accumulatedPoints = accumulatedPointsVal,
                                    reachedMilestones = reachedMilestonesVal
                                )

                                // Top Bar: Separate Sound & Music On/Off Switches on Left side across from "Share" button on Right side on Game Start Screen
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    // Separate Sound & Music On/Off Switches placed on Left side: Sound switch on same height as Share button, double vertical spacing between Sound & Music
                                    Column(
                                        horizontalAlignment = Alignment.Start,
                                        verticalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = AppStrings.rouletteSoundLabel(lang),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = Color.White.copy(alpha = 0.9f),
                                                modifier = Modifier.widthIn(min = 46.dp)
                                            )
                                            Switch(
                                                checked = soundEnabled,
                                                onCheckedChange = { checked ->
                                                    soundEnabled = RouletteSoundEngine.setSoundEnabled(checked, context)
                                                },
                                                modifier = Modifier
                                                    .height(28.dp)
                                                    .scale(0.85f),
                                                colors = SwitchDefaults.colors(
                                                    checkedThumbColor = Color.White,
                                                    checkedTrackColor = Color(0xFFFF5E3A),
                                                    uncheckedThumbColor = Color.LightGray,
                                                    uncheckedTrackColor = Color(0x33FFFFFF)
                                                )
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = AppStrings.rouletteMusicLabel(lang),
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = Color.White.copy(alpha = 0.9f),
                                                modifier = Modifier.widthIn(min = 46.dp)
                                            )
                                            Switch(
                                                checked = musicEnabled,
                                                onCheckedChange = { checked ->
                                                    musicEnabled = RouletteSoundEngine.setMusicEnabled(checked, context)
                                                },
                                                modifier = Modifier
                                                    .height(28.dp)
                                                    .scale(0.85f),
                                                colors = SwitchDefaults.colors(
                                                    checkedThumbColor = Color.White,
                                                    checkedTrackColor = Color(0xFFFF5E3A),
                                                    uncheckedThumbColor = Color.LightGray,
                                                    uncheckedTrackColor = Color(0x33FFFFFF)
                                                )
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(Color(0xE6141A29))
                                            .border(1.2.dp, Color(0xBFD8B467), CircleShape)
                                            .clickable { showSharePreview = true }
                                            .padding(horizontal = 14.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Share,
                                            contentDescription = null,
                                            tint = Color(0xFFF5D061),
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Text(
                                            text = AppStrings.rouletteShareBtn(lang),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFFF5D061)
                                        )
                                    }
                                }
                            }

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier.size(164.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Canvas(modifier = Modifier.fillMaxSize()) {
                                        val center = Offset(size.width / 2f, size.height / 2f)
                                        drawCircle(
                                            brush = Brush.radialGradient(
                                                colors = listOf(
                                                    Color(0x55F5C451),
                                                    Color(0x22B4781C),
                                                    Color.Transparent
                                                ),
                                                center = center,
                                                radius = size.minDimension * 0.5f
                                            ),
                                            radius = size.minDimension * 0.5f,
                                            center = center
                                        )
                                        drawIntactLightbulbContour(
                                            center = center,
                                            radius = size.minDimension * 0.44f,
                                            strokeColor = Color(0xFFF4D06F)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Text(
                                    text = AppStrings.rouletteTitle(lang),
                                    fontSize = 28.sp,
                                    lineHeight = 32.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    textAlign = TextAlign.Center
                                )

                                Spacer(modifier = Modifier.height(6.dp))

                                Text(
                                    text = AppStrings.rouletteSubtitle(lang),
                                    fontSize = 12.sp,
                                    lineHeight = 17.sp,
                                    color = Color(0xFFD4D4D8),
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 10.dp)
                                )

                                Spacer(modifier = Modifier.height(10.dp))

                                // All-Time Best Score Badge on Game Start Screen
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth(0.88f)
                                        .clip(CircleShape)
                                        .background(Color(0xE6141A29))
                                        .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                        .padding(horizontal = 16.dp, vertical = 7.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${AppStrings.rouletteAllTimeBestScoreLabel(lang).uppercase()}:",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFE5D5B5)
                                    )
                                    Text(
                                        text = "$bestScoreVal",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFFF5D061)
                                    )
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                // Power Points ("Бали Потужності" / "Power Points") Bar in same style as All Time Best Score
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth(0.88f)
                                        .clip(CircleShape)
                                        .background(Color(0xE6141A29))
                                        .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                        .padding(horizontal = 16.dp, vertical = 7.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "${AppStrings.roulettePowerPointsLabel(lang).uppercase()}:",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFE5D5B5)
                                    )
                                    Text(
                                        text = "$powerPointsVal",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFFF5D061)
                                    )
                                }
                            }

                            // Start, Power Shop ("Магазин Потужності") & Close Game Vertical Pill Buttons (hidden when Share Card dialog is open so bottom buttons never overlap)
                            if (!showSharePreview) {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(CircleShape)
                                            .background(
                                                Brush.horizontalGradient(
                                                    listOf(Color(0xFFA3221C), Color(0xFFC93B2B), Color(0xFF9E1E18))
                                                )
                                            )
                                            .border(1.5.dp, Color(0xFFD8B467), CircleShape)
                                            .clickable { startOrRefreshTickets(true) }
                                            .padding(vertical = 14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = AppStrings.rouletteStartBtn(lang),
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(CircleShape)
                                            .background(Color(0xD9141A29))
                                            .border(1.3.dp, Color(0xBFD8B467), CircleShape)
                                            .clickable {
                                                gameState = ZhytomyrRouletteEngine.openPowerShop(gameState, context)
                                            }
                                            .padding(vertical = 14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = AppStrings.roulettePowerShopBtn(lang),
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFFE5D5B5)
                                        )
                                    }

                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(CircleShape)
                                            .background(Color.Transparent)
                                            .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                            .clickable { handleCloseGame() }
                                            .padding(vertical = 14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = AppStrings.rouletteCloseBtn(lang),
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFFE5D5B5)
                                        )
                                    }
                                }
                            }
                        }

                        // Printable Share Card Modal with unmodified App Icon (#FF5E3A + white Bolt) & Name ("Світло в Житомирі"), Game Logo (Lightbulb), "Zhytomyr Roulette", Top Score + Power Points bars, bottom centered upgrade glyphs, and 3 Bottom Buttons: Share (mobile standard action), Download Image, Back
                        if (showSharePreview) {
                            val currentUpgradesSet = gameState.purchasedUpgrades.ifEmpty {
                                ZhytomyrRouletteEngine.getPurchasedUpgrades(context)
                            }
                            val currentDepositVal = max(
                                gameState.depositCount,
                                ZhytomyrRouletteEngine.getDepositCount(context)
                            )

                            val launchStandardShareAction: () -> Unit = {
                                try {
                                    val imageUri = ZhytomyrRouletteEngine.saveShareCardBitmapToMediaStore(
                                        context = context,
                                        bestScore = bestScoreVal,
                                        powerPoints = powerPointsVal,
                                        lang = lang,
                                        purchasedUpgrades = currentUpgradesSet,
                                        depositCount = currentDepositVal
                                    )
                                    if (imageUri != null) {
                                        val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "image/png"
                                            putExtra(Intent.EXTRA_STREAM, imageUri)
                                            clipData = ClipData.newRawUri("Zhytomyr Roulette", imageUri)
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        val chooser = Intent.createChooser(sendIntent, AppStrings.rouletteShareBtn(lang)).apply {
                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                        }
                                        context.startActivity(chooser)
                                    }
                                } catch (_: Exception) {
                                }
                            }

                            val handleDownloadImageAction: () -> Unit = {
                                val savedUri = ZhytomyrRouletteEngine.saveShareCardBitmapToMediaStore(
                                    context = context,
                                    bestScore = bestScoreVal,
                                    powerPoints = powerPointsVal,
                                    lang = lang,
                                    purchasedUpgrades = currentUpgradesSet,
                                    depositCount = currentDepositVal
                                )
                                if (savedUri != null) {
                                    onShowAppBanner?.invoke(AppStrings.rouletteImageSavedToast(lang))
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF070A10))
                                    .pointerInput(Unit) {
                                        detectTapGestures { /* Consume taps on empty space on Share screen so buttons in Main App behind Game are never pressed */ }
                                    }
                                    .padding(horizontal = 24.dp, vertical = 14.dp)
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.SpaceBetween
                                ) {
                                    // 1. Share Card Preview Container
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(22.dp))
                                            .background(Color(0xFF0B101C))
                                            .border(1.6.dp, Color(0xFFD8B467), RoundedCornerShape(22.dp))
                                            .padding(16.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        // Unmodified Application Icon (#FF5E3A rounded box + white lightning bolt) & Name ("Світло в Житомирі")
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(34.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(Color(0xFFFF5E3A)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Bolt,
                                                    contentDescription = null,
                                                    tint = Color.White,
                                                    modifier = Modifier.size(22.dp)
                                                )
                                            }
                                            Text(
                                                text = "Світло в Житомирі",
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White
                                            )
                                        }

                                        // Game Logo from Game Start Screen (Lightbulb)
                                        Box(
                                            modifier = Modifier.size(96.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Canvas(modifier = Modifier.fillMaxSize()) {
                                                val center = Offset(size.width / 2f, size.height / 2f)
                                                drawCircle(
                                                    brush = Brush.radialGradient(
                                                        colors = listOf(
                                                            Color(0x55F5C451),
                                                            Color(0x22B4781C),
                                                            Color.Transparent
                                                        ),
                                                        center = center,
                                                        radius = size.minDimension * 0.5f
                                                    ),
                                                    radius = size.minDimension * 0.5f,
                                                    center = center
                                                )
                                                drawIntactLightbulbContour(
                                                    center = center,
                                                    radius = size.minDimension * 0.44f,
                                                    strokeColor = Color(0xFFF4D06F)
                                                )
                                            }
                                        }

                                        Text(
                                            text = "Zhytomyr Roulette",
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color.White
                                        )

                                        // User's Top Score Bar
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(CircleShape)
                                                .background(Color(0xE6141A29))
                                                .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                                .padding(horizontal = 14.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "${AppStrings.rouletteAllTimeBestScoreLabel(lang).uppercase()}:",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFE5D5B5)
                                            )
                                            Text(
                                                text = "$bestScoreVal",
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Color(0xFFF5D061)
                                            )
                                        }

                                        // User's Total Power Points Bar
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(CircleShape)
                                                .background(Color(0xE6141A29))
                                                .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                                .padding(horizontal = 14.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "${AppStrings.roulettePowerPointsLabel(lang).uppercase()}:",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFE5D5B5)
                                            )
                                            Text(
                                                text = "$powerPointsVal",
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Color(0xFFF5D061)
                                            )
                                        }

                                        // Bottom Centered Upgrade Glyphs (strictly grey #6B7280 or golden #F59E0B outline only)
                                        ShareCardUpgradeGlyphsRowComposable(
                                            purchasedUpgrades = currentUpgradesSet,
                                            depositCount = currentDepositVal
                                        )
                                    }

                                    // 2. 3 Bottom Action Buttons: Share (mobile standard action), Download Image, Back
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(CircleShape)
                                                .background(
                                                    Brush.horizontalGradient(
                                                        listOf(Color(0xFFA3221C), Color(0xFFC93B2B), Color(0xFF9E1E18))
                                                    )
                                                )
                                                .border(1.5.dp, Color(0xFFD8B467), CircleShape)
                                                .clickable { launchStandardShareAction() }
                                                .padding(vertical = 14.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = AppStrings.rouletteShareBtn(lang),
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White
                                            )
                                        }

                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(CircleShape)
                                                .background(Color(0xD9141A29))
                                                .border(1.3.dp, Color(0xBFD8B467), CircleShape)
                                                .clickable { handleDownloadImageAction() }
                                                .padding(vertical = 14.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = AppStrings.rouletteDownloadImageBtn(lang),
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFE5D5B5)
                                            )
                                        }

                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(CircleShape)
                                                .background(Color.Transparent)
                                                .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                                .clickable { showSharePreview = false }
                                                .padding(vertical = 14.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = AppStrings.rouletteBackBtn(lang),
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFFE5D5B5)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                RouletteScreenMode.SHOP -> {
                    val finMonLocked = gameState.depositFinMonLocked || ZhytomyrRouletteEngine.isDepositFinMonLocked(context)
                    val powerPointsVal = if (finMonLocked) {
                        ZhytomyrRouletteEngine.getSavedPowerPoints(context)
                    } else {
                        max(gameState.powerPoints, ZhytomyrRouletteEngine.getSavedPowerPoints(context))
                    }
                    val ownedUpgrades = gameState.purchasedUpgrades.ifEmpty { ZhytomyrRouletteEngine.getPurchasedUpgrades(context) }
                    val depositCountVal = max(gameState.depositCount, ZhytomyrRouletteEngine.getDepositCount(context))

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF070A10))
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = AppStrings.roulettePowerShopBtn(lang),
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Color(0xE6141A29))
                                .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                .padding(horizontal = 16.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "${AppStrings.roulettePowerPointsLabel(lang).uppercase()}:",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE5D5B5)
                            )
                            Text(
                                text = "$powerPointsVal",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                fontFamily = FontFamily.Monospace,
                                color = Color(0xFFF5D061)
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        LazyColumn(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(ZhytomyrRouletteEngine.UPGRADES, key = { it.id.key }) { upgrade ->
                                val isPurchased = ownedUpgrades.contains(upgrade.id)
                                val isToggleable = upgrade.isToggleable
                                val isRepeatable = upgrade.isRepeatable
                                val isDepositUpgrade = upgrade.id == RouletteUpgradeId.DEPOSIT_POWER_POINTS
                                val isMilestoneUnlocked = upgrade.requiredMilestone <= 0 ||
                                    ZhytomyrRouletteEngine.isMilestoneReached(upgrade.requiredMilestone, context)
                                val canAfford = when {
                                    !isMilestoneUnlocked -> false
                                    isDepositUpgrade -> !finMonLocked && powerPointsVal >= upgrade.cost
                                    isToggleable || isRepeatable -> powerPointsVal >= upgrade.cost
                                    else -> !isPurchased && powerPointsVal >= upgrade.cost
                                }
                                val btnLabel = upgrade.formatButtonLabel(lang, isPurchased, depositCountVal)
                                val desc = ZhytomyrRouletteEngine.getUpgradeDescription(upgrade, lang, finMonLocked)

                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color(0xCC0E1422))
                                        .border(1.dp, Color(0x40D8B467), RoundedCornerShape(16.dp))
                                        .padding(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(CircleShape)
                                            .background(
                                                if (canAfford) {
                                                    Brush.horizontalGradient(
                                                        listOf(Color(0xFFA3221C), Color(0xFFC93B2B), Color(0xFF9E1E18))
                                                    )
                                                } else {
                                                    Brush.horizontalGradient(
                                                        listOf(Color(0xFF141A29), Color(0xFF141A29))
                                                    )
                                                }
                                            )
                                            .border(
                                                width = if (canAfford) 1.5.dp else 1.2.dp,
                                                color = if (canAfford) Color(0xFFD8B467) else Color(0x8CD8B467),
                                                shape = CircleShape
                                            )
                                            .clickable(enabled = canAfford) {
                                                handlePurchaseUpgrade(upgrade.id)
                                            }
                                            .padding(vertical = 12.dp, horizontal = 14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = btnLabel,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = when {
                                                isPurchased && !isToggleable && !isRepeatable -> Color(0xFFF5D061)
                                                canAfford -> Color.White
                                                else -> Color(0x88E5D5B5)
                                            },
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier
                                                .align(Alignment.Center)
                                                .padding(end = 28.dp)
                                        )
                                        // Green "V" mark on purchased items always in the same position on the right side of the bar and aligned vertically
                                        if (isPurchased) {
                                            Box(
                                                modifier = Modifier
                                                    .align(Alignment.CenterEnd)
                                                    .size(20.dp)
                                                    .clip(CircleShape)
                                                    .background(Color(0x3316A34A))
                                                    .border(1.5.dp, Color(0xFF4ADE80), CircleShape),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = "V",
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = Color(0xFF4ADE80)
                                                )
                                            }
                                        }
                                    }

                                    if (desc.isNotEmpty()) {
                                        Text(
                                            text = desc,
                                            fontSize = 11.sp,
                                            lineHeight = 15.sp,
                                            color = Color(0xFFD4D4D8),
                                            modifier = Modifier.padding(horizontal = 6.dp)
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(CircleShape)
                                .background(Color.Transparent)
                                .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                .clickable {
                                    gameState = ZhytomyrRouletteEngine.closePowerShop(gameState, context)
                                }
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = AppStrings.rouletteBackBtn(lang),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE5D5B5)
                            )
                        }
                    }
                }

                RouletteScreenMode.PLAYING, RouletteScreenMode.FADING_TO_BLACK -> {
                    val isFadingToBlack = gameState.screen == RouletteScreenMode.FADING_TO_BLACK
                    val hourlyPairs = remember(gameState.tickets) {
                        ZhytomyrRouletteEngine.getHourlyTicketPairs(gameState.tickets)
                    }
                    val canRefresh = !isFadingToBlack &&
                        ZhytomyrRouletteEngine.canRefreshTickets(gameState.score, gameState.refreshCount)

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(if (isGameBlackoutActive) Color(0xFF020306) else Color(0xFF070A10))
                    ) {
                        Column(modifier = Modifier.fillMaxSize()) {
                            // Top Score Bar + Extra Heart Icons ("Second Life" + "Perseverance")
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF0B0F18))
                                    .padding(horizontal = 16.dp, vertical = 14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "${AppStrings.roulettePointsLabel(lang).uppercase()}:",
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                    Text(
                                        text = "${gameState.score}",
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFFF5D061)
                                    )
                                    if (gameState.extraLivesTotal > 0) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            for (heartIdx in 0 until gameState.extraLivesTotal) {
                                                val isHeartUsed = heartIdx >= (gameState.extraLivesTotal - gameState.extraLivesUsed)
                                                HeaderHeartIconComposable(used = isHeartUsed)
                                            }
                                        }
                                    }
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "${AppStrings.rouletteStreakLabel(lang).uppercase()}:",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                    Text(
                                        text = "+${gameState.streakIncrement}",
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color(0xFFF5D061)
                                    )
                                }
                            }

                            // 2-Column Hourly Grid of 48 Timeslot Lottery Tickets (scroll position preserved on Game Over FADING_TO_BLACK via ticketListState)
                            LazyColumn(
                                state = ticketListState,
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp),
                                contentPadding = PaddingValues(vertical = 12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                itemsIndexed(hourlyPairs, key = { idx, _ -> "hour_pair_${idx}_${gameState.generationId}" }) { rowIndex, pair ->
                                    val isRowDealt = rowIndex < dealtRowsCount
                                    val rowSlideProgress by animateFloatAsState(
                                        targetValue = if (isRowDealt) 1f else 0f,
                                        animationSpec = tween(durationMillis = 480, easing = FastOutSlowInEasing),
                                        label = "ticketRowTopBorderSlide_$rowIndex"
                                    )
                                    if (isRowDealt || rowSlideProgress > 0.01f) {
                                        val topBorderOffsetPx = -((rowIndex + 1) * 84f) * (1f - rowSlideProgress)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .graphicsLayer {
                                                    alpha = rowSlideProgress
                                                    translationY = topBorderOffsetPx
                                                },
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Box(modifier = Modifier.weight(1f)) {
                                                ScratchTicketComposable(
                                                    ticket = pair.first,
                                                    generationId = gameState.generationId,
                                                    disabled = isFadingToBlack || isGameBlackoutActive,
                                                    isBlackoutActive = isGameBlackoutActive,
                                                    foilBitmap = bitmapForVariant(pair.first.visualVariant),
                                                    onReveal = handleTicketReveal
                                                )
                                            }
                                            Box(modifier = Modifier.weight(1f)) {
                                                ScratchTicketComposable(
                                                    ticket = pair.second,
                                                    generationId = gameState.generationId,
                                                    disabled = isFadingToBlack || isGameBlackoutActive,
                                                    isBlackoutActive = isGameBlackoutActive,
                                                    foilBitmap = bitmapForVariant(pair.second.visualVariant),
                                                    onReveal = handleTicketReveal
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // Bottom 2 Buttons: Restart Game & Get New Tickets (disabled if insufficient points)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF0B0F18))
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(CircleShape)
                                        .background(Color.Transparent)
                                        .border(1.2.dp, Color(0x99D8B467), CircleShape)
                                        .clickable {
                                            gameState = ZhytomyrRouletteEngine.applyRestartGame(
                                                gameState.copy(screen = RouletteScreenMode.PLAYING),
                                                context = context
                                            )
                                        }
                                        .padding(vertical = 13.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = AppStrings.rouletteRestartBtn(lang),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(CircleShape)
                                        .background(
                                            if (canRefresh) {
                                                Brush.linearGradient(
                                                    listOf(Color(0xFFE2CE9F), Color(0xFFC6AE7A))
                                                )
                                            } else {
                                                Brush.linearGradient(
                                                    listOf(Color(0x554B5563), Color(0x55374151))
                                                )
                                            }
                                        )
                                        .clickable(enabled = canRefresh) {
                                            startOrRefreshTickets(false)
                                        }
                                        .padding(vertical = 13.dp, horizontal = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Refresh,
                                            contentDescription = null,
                                            tint = if (canRefresh) Color(0xFF1B1406) else Color(0xFF9CA3AF),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = AppStrings.formatRouletteNewTicketsBtnWithCost(
                                                lang,
                                                gameState.refreshCount
                                            ),
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (canRefresh) Color(0xFF1B1406) else Color(0xFF9CA3AF)
                                        )
                                    }
                                }
                            }
                        }

                        if (currentScreen == RouletteScreenMode.FADING_TO_BLACK || fadeAlpha > 0.01f) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = fadeAlpha.coerceIn(0f, 1f)))
                            )
                        }
                    }
                }

                RouletteScreenMode.GAME_OVER -> {
                    val accumulatedPointsVal = max(
                        max(gameState.powerPoints, ZhytomyrRouletteEngine.getSavedPowerPoints(context)),
                        ZhytomyrRouletteEngine.getAccumulatedPowerPoints(context)
                    )
                    val reachedMilestonesVal = ZhytomyrRouletteEngine.getReachedMilestones(context)

                    // Game Over Screen: Progress bar on top + Vertical button placement, same as on Game Start Screen
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black)
                            .padding(horizontal = 24.dp, vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        PowerPointsMilestoneProgressBarComposable(
                            accumulatedPoints = accumulatedPointsVal,
                            reachedMilestones = reachedMilestonesVal
                        )

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                            modifier = Modifier.weight(1f)
                        ) {
                            MultiFrameExplodingBulbCanvas(
                                modifier = Modifier.size(220.dp)
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            Text(
                                text = AppStrings.rouletteGameOverTitle(lang),
                                fontSize = 30.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                textAlign = TextAlign.Center
                            )

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    text = "${AppStrings.rouletteFinalScoreLabel(lang)}: ${gameState.score}",
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF4F4F5),
                                    textAlign = TextAlign.Center
                                )
                                if (gameState.dailyStreakApplied) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0x33F59E0B))
                                            .border(2.dp, Color(0xFFF5D061), RoundedCornerShape(10.dp))
                                            .padding(horizontal = 10.dp, vertical = 4.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "X2",
                                            fontSize = 22.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Black,
                                            color = Color(0xFFF5D061)
                                        )
                                    }
                                }
                            }
                        }

                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            // Restart button on Game Over screen bypasses Game Start screen and starts a new game immediately
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(CircleShape)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(Color(0xFFA3221C), Color(0xFFC93B2B), Color(0xFF9E1E18))
                                        )
                                    )
                                    .border(1.5.dp, Color(0xFFD8B467), CircleShape)
                                    .clickable {
                                        startOrRefreshTickets(true)
                                    }
                                    .padding(vertical = 15.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = AppStrings.rouletteRestartBtn(lang),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }

                            // "Main Menu" ("Головне Меню") button between Restart Game and Close Game to return to Game Start Screen
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(CircleShape)
                                    .background(Color(0xD9141A29))
                                    .border(1.3.dp, Color(0xBFD8B467), CircleShape)
                                    .clickable {
                                        gameState = ZhytomyrRouletteEngine.applyReturnToMainMenu(gameState, context)
                                    }
                                    .padding(vertical = 15.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = AppStrings.rouletteMainMenuBtn(lang),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFE5D5B5)
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(CircleShape)
                                    .background(Color.Transparent)
                                    .border(1.2.dp, Color(0x8CD8B467), CircleShape)
                                    .clickable { handleCloseGame() }
                                    .padding(vertical = 15.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = AppStrings.rouletteCloseBtn(lang),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFE5D5B5)
                                )
                            }
                        }
                    }
                }
            }
        }

        if (animatedFlickerAlpha > 0.01f && gameState.screen != RouletteScreenMode.GAME_OVER) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = animatedFlickerAlpha.coerceIn(0f, 0.85f)))
            )
        }
    }
}
