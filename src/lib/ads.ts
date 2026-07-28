export const POPUNDER_URL = 'https://affectionatestorage.com/bb3EVJ0hP.3jpmvqbYmXVDJ_ZeDv0/3fMmjtUL4_NljpYN1WL/TAcsyFNYTBgt2lNxjXkX';

export function openPopunder() {
  try {
    window.open(POPUNDER_URL, '_blank');
  } catch {
    // ignore — ad blockers may prevent this
  }
}
