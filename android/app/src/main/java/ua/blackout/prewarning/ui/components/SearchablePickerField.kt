package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType

/** One row of a [SearchablePickerField]. [id] must be unique inside one list; duplicates are dropped. */
@Immutable
data class PickerItem(val id: String, val label: String)

/** Colours of the app's glass text fields: dark fill, hairline border, accent when focused, light icons and cursor. */
@Composable
fun glassFieldColors(
    focusedBorder: Color = ZtColors.Accent,
    unfocusedBorder: Color = ZtColors.InputBorder
) = OutlinedTextFieldDefaults.colors(
    focusedTextColor = Color.White,
    unfocusedTextColor = Color.White,
    disabledTextColor = Color(0x80FFFFFF),
    focusedBorderColor = focusedBorder,
    unfocusedBorderColor = unfocusedBorder,
    disabledBorderColor = Color(0x1AFFFFFF),
    focusedContainerColor = Color(0x1AFFFFFF),
    unfocusedContainerColor = ZtColors.InnerRow,
    disabledContainerColor = Color(0x0DFFFFFF),
    cursorColor = ZtColors.Accent,
    focusedTrailingIconColor = Color.White,
    unfocusedTrailingIconColor = Color(0xB3FFFFFF),
    disabledTrailingIconColor = Color(0x4DFFFFFF),
    focusedLeadingIconColor = Color(0xB3FFFFFF),
    unfocusedLeadingIconColor = Color(0xB3FFFFFF),
    focusedPlaceholderColor = ZtColors.TextTertiary,
    unfocusedPlaceholderColor = ZtColors.TextTertiary
)

/**
 * A read-only field that opens a full-screen searchable list. Built for the address lookup, where one
 * list can hold 966 streets: rows are lazy and keyed by [PickerItem.id], search is [PickerSearch]
 * (apostrophe, diacritic, case and street-type-prefix insensitive), and there is no entrance animation
 * because people open it often.
 *
 * States: [loading] (spinner; a thin bar when rows are already shown), [loadFailed] (message with
 * Retry when [onRetry] is set), and an empty result ("Нічого не знайдено").
 *
 * @param value text shown in the field, or null to show [placeholder]
 * @param selectedId id of the current value; gets the check mark and the initial scroll position
 * @param enabled when false the field is dimmed and does not open ([disabledHint] is read by TalkBack)
 * @param kind [PickerSearch.Kind.HOUSE] for house numbers ("16А" equals "16a", "34-А" equals "34а")
 */
@Composable
fun SearchablePickerField(
    label: String,
    value: String?,
    placeholder: String,
    items: List<PickerItem>,
    selectedId: String?,
    onSelect: (PickerItem) -> Unit,
    lang: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadFailed: Boolean = false,
    onRetry: (() -> Unit)? = null,
    kind: PickerSearch.Kind = PickerSearch.Kind.TEXT,
    disabledHint: String? = null
) {
    var open by remember { mutableStateOf(false) }
    val shape = ZtShapes.Control
    val shownText = value?.takeIf { it.isNotBlank() } ?: placeholder

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = label, style = ZtType.label, color = Color(0xE6BAE6FD))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(shape)
                .background(if (enabled) ZtColors.InnerRow else Color(0x0DFFFFFF))
                .border(1.dp, if (enabled) ZtColors.InputBorder else Color(0x1AFFFFFF), shape)
                .clickable(enabled = enabled, role = Role.Button, onClickLabel = label) { open = true }
                .semantics(mergeDescendants = true) {
                    contentDescription = "$label, $shownText"
                    if (!enabled && disabledHint != null) stateDescription = disabledHint
                }
                .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = shownText,
                style = ZtType.body,
                color = when {
                    !enabled -> Color(0x80FFFFFF)
                    value.isNullOrBlank() -> ZtColors.TextTertiary
                    else -> Color.White
                },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(horizontal = 8.dp).size(18.dp),
                    strokeWidth = 2.dp,
                    color = ZtColors.Accent
                )
            }
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = null,
                tint = if (enabled) Color(0xB3FFFFFF) else Color(0x4DFFFFFF),
                modifier = Modifier.size(24.dp)
            )
        }
    }

    if (open) {
        PickerDialog(
            title = label,
            items = items,
            selectedId = selectedId,
            lang = lang,
            loading = loading,
            loadFailed = loadFailed,
            onRetry = onRetry,
            kind = kind,
            onDismiss = { open = false },
            onSelect = {
                open = false
                onSelect(it)
            }
        )
    }
}

@Composable
private fun PickerDialog(
    title: String,
    items: List<PickerItem>,
    selectedId: String?,
    lang: String,
    loading: Boolean,
    loadFailed: Boolean,
    onRetry: (() -> Unit)?,
    kind: PickerSearch.Kind,
    onDismiss: () -> Unit,
    onSelect: (PickerItem) -> Unit
) {
    // duplicate ids would crash LazyColumn(key = id), so the list is made unique once
    val unique = remember(items) { items.distinctBy { it.id } }
    val index = remember(unique, kind) { PickerSearch.Index(unique, kind) { it.label } }
    var query by remember { mutableStateOf("") }
    val shown = remember(index, query) { index.search(query) }
    val initialIndex = remember { unique.indexOfFirst { it.id == selectedId }.coerceAtLeast(0) }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        withFrameNanos { }
        try {
            focusRequester.requestFocus()
        } catch (_: Exception) {
            // the field is not attached yet on a very slow first frame; the user can still tap it
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ZtColors.CardSolid)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 4.dp, end = 16.dp, top = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss, modifier = Modifier.size(ZtMinTouch)) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = AppStrings.pickerClose(lang),
                        tint = Color.White
                    )
                }
                Text(
                    text = title,
                    style = ZtType.heading,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(start = 4.dp)
                )
            }

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .heightIn(min = 56.dp)
                    .focusRequester(focusRequester),
                singleLine = true,
                shape = ZtShapes.Control,
                textStyle = ZtType.body,
                placeholder = { Text(AppStrings.pickerSearchHint(lang), style = ZtType.body) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = if (query.isNotEmpty()) {
                    {
                        IconButton(onClick = { query = "" }, modifier = Modifier.size(ZtMinTouch)) {
                            Icon(Icons.Default.Close, contentDescription = AppStrings.pickerClearSearch(lang))
                        }
                    }
                } else null,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Search
                ),
                keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
                colors = glassFieldColors()
            )

            if (loading && shown.isNotEmpty()) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    color = ZtColors.Accent,
                    trackColor = Color(0x1AFFFFFF)
                )
            }
            if (loadFailed && unique.isNotEmpty()) {
                PickerStatusRow(
                    text = AppStrings.pickerLoadError(lang),
                    lang = lang,
                    onRetry = onRetry,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    shown.isNotEmpty() -> LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 16.dp)
                    ) {
                        items(shown, key = { it.id }) { item ->
                            PickerRow(
                                text = item.label,
                                selected = item.id == selectedId,
                                lang = lang,
                                onClick = { onSelect(item) }
                            )
                        }
                    }
                    loading -> CenteredColumn {
                        CircularProgressIndicator(color = ZtColors.Accent, strokeWidth = 3.dp)
                        Text(AppStrings.pickerLoading(lang), style = ZtType.body, color = ZtColors.TextSecondary)
                    }
                    loadFailed && unique.isEmpty() -> CenteredColumn {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = ZtColors.ChipRedText, modifier = Modifier.size(32.dp))
                        Text(
                            AppStrings.pickerLoadError(lang),
                            style = ZtType.body,
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                        if (onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
                    }
                    else -> CenteredColumn {
                        Text(
                            AppStrings.pickerNothingFound(lang),
                            style = ZtType.body,
                            color = ZtColors.TextSecondary,
                            textAlign = TextAlign.Center
                        )
                        if (unique.isEmpty() && onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
                    }
                }
            }
        }
    }
}

@Composable
private fun PickerRow(text: String, selected: Boolean, lang: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .background(if (selected) ZtColors.InnerRow else Color.Transparent)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = text,
            style = ZtType.body,
            color = Color.White,
            modifier = Modifier.weight(1f).padding(end = 12.dp)
        )
        if (selected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = AppStrings.pickerSelected(lang),
                tint = ZtColors.Accent,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
private fun PickerStatusRow(text: String, lang: String, onRetry: (() -> Unit)?, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = ZtColors.ChipRedText, modifier = Modifier.size(20.dp))
        Text(text, style = ZtType.caption, color = ZtColors.ChipRedText, modifier = Modifier.weight(1f))
        if (onRetry != null) PickerRetryButton(lang = lang, onRetry = onRetry)
    }
}

@Composable
private fun PickerRetryButton(lang: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Control)
            .background(Color(0x1AFFFFFF))
            .border(1.dp, ZtColors.InputBorder, ZtShapes.Control)
            .clickable(role = Role.Button, onClick = onRetry)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(AppStrings.pickerRetry(lang), style = ZtType.label, color = Color.White)
    }
}

@Composable
private fun CenteredColumn(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        content()
    }
}
