/** Legacy menu URLs that map to existing product pages. */
export const PRODUCT_ALIASES: Record<string, string> = {
  'anti-rimpel-creme': 'beste-anti-rimpel-creme',
  'anti-roos-schampoo': 'beste-anti-roos-shampoo',
  concealer: 'beste-concealer',
  'corrigerend-ondergoed-buik': 'beste-corrigerend-ondergoed-buik',
  'creme-tegen-acne': 'beste-creme-tegen-acne',
  'creme-tegen-wallen': 'beste-creme-tegen-wallen',
  dagcreme: 'beste-dagcreme',
  'figuurcorrigerend-ondergoed': 'beste-figuurcorrigerend-ondergoed',
  'foam-roller': 'beste-foam-roller',
  'haar-wax-mannen': 'beste-haar-wax-mannen',
  'haarmasker-droog-haar': 'beste-haarmasker-droog-haar',
  'haarverf-kastanjebruin': 'beste-haarverf-kastanjebruin',
  'keratine-shampoo': 'beste-keratine-shampoo',
  'krultang-voor-kort-haar': 'beste-krultang-voor-kort-haar',
  'magnetische-wimpers': 'beste-magnetische-wimpers',
  mondwater: 'beste-mondwater',
  'natuurlijke-shampoo': 'beste-natuurlijke-shampoo',
  'olie-beschadigd-haar': 'beste-olie-voor-beschadigd-haar',
  'oogcreme-rimpels': 'beste-oogcreme-rimpels',
  parfum: 'beste-parfum',
  'puisten-creme': 'beste-puisten-creme',
  'shampoo-gekleurd-haar': 'beste-shampoo-gekleurd-haar',
  'shampoo-zonder-sulfaten': 'beste-shampoo-zonder-sulfaten',
  shapewear: 'beste-shapewear',
  'tondeuse-voor-dik-haar': 'beste-tondeuse-voor-dik-haar',
  'tondeuse-voor-kort-haar': 'beste-tondeuse-voor-kort-haar',
  'tondeuse-voor-mannen': 'beste-tondeuse-voor-mannen',
  'zelfbruinende-olie': 'beste-zelfbruiner-olie',
  'zelfbruiner-gezicht': 'beste-zelfbruiner-gezicht',
  'zelfbruiner-mousse': 'beste-zelfbruiner-mousse',
};

export function getAliasTarget(slug: string): string | undefined {
  return PRODUCT_ALIASES[slug];
}
