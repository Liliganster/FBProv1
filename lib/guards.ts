export function isCrewFirstCallsheet(x: any): x is { date: string; projectName: string; locations: string[] } {
  return (
    x && typeof x === 'object' &&
    typeof x.date === 'string' &&
    typeof x.projectName === 'string' &&
    Array.isArray(x.locations) && x.locations.every((s: any) => typeof s === 'string')
  );
}

