import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_ENDPOINTS } from '../system-core-api-paths';
import { HttpMethod } from '../../../helpers/http';
import { env } from '../../../helpers/env';
import { contexte, etape } from '../../../helpers/scenario';

/**
 * Garde-fou de couverture : compare les routes déclarées par les contrôleurs
 * Spring au registre agrégé des modules.
 *
 * C'est le seul test qui regarde le dépôt backend, et il le fait uniquement à
 * travers `BACKEND_SOURCE_PATH` (.env). Quand la variable n'est pas renseignée
 * — cas d'une CI qui ne clone que le dépôt AQA — le test se met en skip.
 */
interface RouteJava {
  method: HttpMethod;
  template: string;
  fichier: string;
}

/** Liste récursivement les contrôleurs REST du backend. */
function listerControleurs(racine: string): string[] {
  const resultats: string[] = [];
  for (const entree of fs.readdirSync(racine, { withFileTypes: true })) {
    const complet = path.join(racine, entree.name);
    if (entree.isDirectory()) {
      resultats.push(...listerControleurs(complet));
    } else if (entree.name.endsWith('RestController.java')) {
      resultats.push(complet);
    }
  }
  return resultats;
}

/** Extrait les routes (verbe + gabarit d'URL) d'un contrôleur. */
function extraireRoutes(fichier: string): RouteJava[] {
  const source = fs.readFileSync(fichier, 'utf-8');
  const base = /@RequestMapping\(\s*"([^"]*)"\s*\)/.exec(source)?.[1] ?? '';
  const routes: RouteJava[] = [];

  const motif = /@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*)?"([^"]*)"\s*\))?/g;
  for (let match = motif.exec(source); match !== null; match = motif.exec(source)) {
    const method = match[1].toLowerCase() as HttpMethod;
    const suffixe = match[2] ?? '';
    const normalise = suffixe && !suffixe.startsWith('/') ? `/${suffixe}` : suffixe;
    routes.push({ method, template: `${base}${normalise}`, fichier: path.basename(fichier) });
  }
  return routes;
}

/** Transforme un gabarit Spring (`/api/x/{id}`) en expression régulière. */
function versRegex(template: string): RegExp {
  const echappe = template
    .replace(/[.*+?^${}()|[\]\\]/g, (caractere) =>
      caractere === '{' || caractere === '}' ? caractere : `\\${caractere}`,
    )
    .replace(/\{[^}]*\}/g, '[^/]+');
  return new RegExp(`^${echappe}$`);
}

/** Charge les routes du backend, ou `null` si les sources ne sont pas là. */
function routesBackend(): RouteJava[] | null {
  const racine = env.backendSourcePath;
  if (!racine || !fs.existsSync(racine)) return null;
  return listerControleurs(racine).flatMap(extraireRoutes);
}

test.describe('API — Surface exposée', () => {
  test('chaque route des contrôleurs Spring est couverte par le registre', async () => {
    await contexte({
      preconditions: [
        'Les sources Java du backend sont accessibles depuis le dépôt AQA',
        'Le registre agrégé recense les routes déclarées par chaque module',
      ],
      configuration: [
        'BACKEND_SOURCE_PATH désigne les sources du backend ; sans elle le cas est ignoré',
      ],
    });

    const routesJava = routesBackend();
    test.skip(
      routesJava === null,
      'BACKEND_SOURCE_PATH non renseigné ou introuvable : garde-fou ignoré',
    );

    await etape(
      'Relever les routes déclarées par les contrôleurs REST du backend',
      'Au moins une route est détectée, faute de quoi c’est le relevé lui-même qui est en cause',
      async () => {
        expect(
          routesJava!.length,
          'aucune route détectée : le parseur est à revoir',
        ).toBeGreaterThan(0);
      },
    );

    await etape(
      'Confronter chaque route du backend au registre des modules',
      'Aucune route du backend n’est absente du registre : toute la surface exposée est couverte par des tests',
      async () => {
        const nonCouvertes = routesJava!.filter((route) => {
          const regex = versRegex(route.template);
          return !ALL_ENDPOINTS.some((e) => e.method === route.method && regex.test(e.path));
        });

        expect(
          nonCouvertes.map((r) => `${r.method.toUpperCase()} ${r.template} (${r.fichier})`),
          'routes backend absentes des fichiers *-api-paths.ts',
        ).toEqual([]);
      },
    );
  });

  test('le registre ne référence pas de route inconnue du backend', async () => {
    await contexte({
      preconditions: [
        'Les sources Java du backend sont accessibles depuis le dépôt AQA',
        'Le registre agrégé recense les routes déclarées par chaque module',
      ],
      configuration: [
        'BACKEND_SOURCE_PATH désigne les sources du backend ; sans elle le cas est ignoré',
      ],
    });

    const routesJava = routesBackend();
    test.skip(
      routesJava === null,
      'BACKEND_SOURCE_PATH non renseigné ou introuvable : garde-fou ignoré',
    );

    await etape(
      'Confronter chaque route du registre aux contrôleurs du backend',
      'Aucune route du registre ne désigne un endpoint disparu : le registre ne teste rien d’imaginaire',
      async () => {
        const orphelines = ALL_ENDPOINTS.filter(
          (e) =>
            !routesJava!.some(
              (route) => route.method === e.method && versRegex(route.template).test(e.path),
            ),
        );

        expect(
          orphelines.map((e) => `${e.method.toUpperCase()} ${e.path}`),
          'routes du registre qui n’existent plus côté backend',
        ).toEqual([]);
      },
    );
  });
});
