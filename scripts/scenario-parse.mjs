/**
 * Lecture statique des declarations de `helpers/scenario.ts`.
 * ---------------------------------------------------------------------------
 * Un cas de test se lit a deux endroits : dans Allure apres l'execution, et
 * dans Squash TM comme specification. Les deux doivent raconter la meme chose,
 * donc la source est unique : ce que le test declare via `contexte()` et
 * `etape()`.
 *
 * Le catalogue Squash est bati depuis `playwright test --list`, qui n'execute
 * rien : la lecture est donc purement textuelle. C'est ce qui impose aux
 * libelles de rester des chaines litterales dans les tests.
 */

/** Retire les echappements d'une chaine litterale JavaScript. */
export function unescapeLiteral(s) {
  const antislash = String.fromCharCode(92);
  const echappe = new RegExp(antislash + antislash + '([' + "'" + '"`' + antislash + antislash + '])', 'g');
  return String(s).replace(echappe, '$1').replace(/\s+/g, ' ').trim();
}

/**
 * Etapes redigees : `etape('action', 'resultat attendu', ...)`.
 *
 * Seuls les deux premiers arguments sont lus, et uniquement s'ils sont des
 * chaines litterales : une variable ne dirait rien au lecteur du cas Squash.
 */
export function scenarioSteps(body) {
  if (!body) return [];
  const a = String.fromCharCode(92); // antislash, hors litteral pour survivre aux heredocs
  const chaine = (n) => `(['"\`])((?:${a}${a}.|(?!${a}${n})[${a}s${a}S])*?)${a}${n}`;
  const re = new RegExp(
    `${a}betape${a}s*${a}(${a}s*` + chaine(1) + `${a}s*,${a}s*` + chaine(3) + `${a}s*,`,
    'g'
  );
  const steps = [];
  let m;
  while ((m = re.exec(body))) {
    const action = unescapeLiteral(m[2]);
    const attendu = unescapeLiteral(m[4]);
    if (action) steps.push({ action, expected_result: attendu });
  }
  return steps;
}

/**
 * Prerequis declares par `contexte({ preconditions: [...], configuration: [...] })`.
 */
export function scenarioContext(body) {
  const vide = { preconditions: [], configuration: [] };
  if (!body) return vide;
  const a = String.fromCharCode(92);
  const bloc = body.match(new RegExp(`${a}bcontexte${a}s*${a}(${a}s*{([${a}s${a}S]*?)}${a}s*${a})`));
  if (!bloc) return vide;

  const liste = (nom) => {
    const m = bloc[1].match(new RegExp(`${nom}${a}s*:${a}s*${a}[([${a}s${a}S]*?)${a}]`));
    if (!m) return [];
    const re = new RegExp(`(['"\`])((?:${a}${a}.|(?!${a}1)[${a}s${a}S])*?)${a}1`, 'g');
    const items = [];
    let x;
    while ((x = re.exec(m[1]))) {
      const v = unescapeLiteral(x[2]);
      if (v) items.push(v);
    }
    return items;
  };

  return { preconditions: liste('preconditions'), configuration: liste('configuration') };
}
