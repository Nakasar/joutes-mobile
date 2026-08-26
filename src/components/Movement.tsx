/**
 * Le titre d'un mouvement : un nom en héraldique, un filet d'or qui court
 * jusqu'au bord, et une mention en petite capitale.
 *
 * Il remplace la `.section-label` — dix caractères en majuscules grises —
 * partout où la section appartient à l'héraldique de Joutes : le rôle d'armes
 * des groupes, l'annuaire des lieux, la vitrine d'un joueur, celle d'un lieu.
 * Le filet fait le travail que la majuscule faisait mal : il dit où la section
 * commence sans crier son nom.
 *
 * `section` réduit le titre là où le mouvement n'est qu'une section d'une fiche
 * et non le titre d'un rôle entier.
 */
export function Movement({
  title,
  aside,
  asideTone,
  section = false,
}: {
  title: string;
  aside?: string;
  asideTone?: "open";
  section?: boolean;
}) {
  return (
    <div className={`movement${section ? " movement--section" : ""}`}>
      <h2 className="movement__title">{title}</h2>
      <span className="movement__rule" aria-hidden />
      {aside && (
        <span className={`movement__aside${asideTone ? ` movement__aside--${asideTone}` : ""}`}>
          {aside}
        </span>
      )}
    </div>
  );
}
