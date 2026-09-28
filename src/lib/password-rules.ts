// Client və server üçün ortaq şifrə qaydaları (native modul import etmir)
export const PASSWORD_MIN = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Şifrə ən azı ${PASSWORD_MIN} simvol olmalıdır.`;
  if (password.length > 200) return "Şifrə çox uzundur.";
  return null;
}
