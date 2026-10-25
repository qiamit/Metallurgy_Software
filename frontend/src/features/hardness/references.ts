/** ISO 6506-1 Table 3 — force-diameter ratio 0.102·F/D² by material and hardness. */
export const BRINELL_RATIO_GUIDE: { material: string; range: string; ratios: string }[] = [
  { material: 'Steel, nickel alloys, titanium alloys', range: '—', ratios: '30' },
  { material: 'Cast iron', range: '< 140 HBW', ratios: '10' },
  { material: 'Cast iron', range: '≥ 140 HBW', ratios: '30' },
  { material: 'Copper and copper alloys', range: '< 35 HBW', ratios: '5' },
  { material: 'Copper and copper alloys', range: '35 – 200 HBW', ratios: '10' },
  { material: 'Copper and copper alloys', range: '> 200 HBW', ratios: '30' },
  { material: 'Light metals and alloys', range: '< 35 HBW', ratios: '2.5' },
  { material: 'Light metals and alloys', range: '35 – 80 HBW', ratios: '5, 10, 15' },
  { material: 'Light metals and alloys', range: '> 80 HBW', ratios: '10, 15' },
  { material: 'Lead, tin', range: '—', ratios: '1' },
]
