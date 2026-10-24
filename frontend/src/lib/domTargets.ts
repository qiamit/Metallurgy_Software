export function elementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

/** Floating combobox lists rendered outside a dialog carry this attribute. */
export const FLOATING_DROPDOWN_ATTR = 'data-floating-dropdown'

export function isFilterComboboxDropdownTarget(target: EventTarget | null): boolean {
  const el = elementFromEventTarget(target)
  return Boolean(el?.closest(`[${FLOATING_DROPDOWN_ATTR}]`))
}
