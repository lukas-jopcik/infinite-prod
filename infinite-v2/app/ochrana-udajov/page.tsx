import type { Metadata } from "next"
import { SITE_CONFIG } from "@/lib/config"

export const metadata: Metadata = {
  title: "Ochrana údajov | Infinite",
  description: "Informácie o ochrane osobných údajov, cookies a reklamách na Infinite.sk. Zistite, ako používame vaše údaje a aké máte práva.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Ochrana údajov | Infinite",
    description: "Informácie o ochrane osobných údajov, cookies a reklamách na Infinite.sk",
    type: "website",
  },
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold text-foreground mb-8">Ochrana osobných údajov</h1>
        
        <p className="text-muted-foreground mb-8">
          <strong>Posledná aktualizácia:</strong> {new Date().toLocaleDateString('sk-SK')}
        </p>

        <div className="space-y-8">
          {/* Úvod */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Úvod</h2>
            <p className="text-muted-foreground leading-relaxed">
              Vítame vás na Infinite.sk, kde sa venujeme objavom z vesmíru a astronómii. 
              Táto stránka ochrany údajov vysvetľuje, ako zhromažďujeme, používame a chrátime 
              vaše osobné údaje v súlade s nariadením GDPR a slovenskými zákonmi o ochrane údajov.
            </p>
          </section>

          {/* Správca údajov */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Správca osobných údajov</h2>
            <div className="bg-muted p-6 rounded-lg">
              <p className="text-muted-foreground mb-2">
                <strong>Názov:</strong> Infinite.sk
              </p>
              <p className="text-muted-foreground mb-2">
                <strong>Webová stránka:</strong> {SITE_CONFIG.url}
              </p>
              <p className="text-muted-foreground">
                <strong>Kontakt:</strong> info@infinite.sk
              </p>
            </div>
          </section>

          {/* AdSense a reklamy */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Google AdSense a reklamy</h2>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Ako fungujú reklamy na našej stránke
              </h3>
              <p className="text-blue-800 dark:text-blue-200 mb-4">
                Naša stránka používa Google AdSense na zobrazovanie reklám. Toto nám pomáha 
                financovať prevádzku stránky a poskytovať vám bezplatný obsah o vesmíre a astronómii.
              </p>
              
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Čo to znamená pre vás:</h4>
              <ul className="list-disc list-inside text-blue-800 dark:text-blue-200 space-y-1 mb-4">
                <li>Google môže používať cookies na personalizáciu reklám</li>
                <li>Reklamy sa môžu zobrazovať na základe vašich záujmov</li>
                <li>Môžete si nastaviť preferencie reklám v Google Ads Settings</li>
                <li>Môžete odmietnuť cookies pre reklamy</li>
              </ul>

              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Vaše možnosti:</h4>
              <ul className="list-disc list-inside text-blue-800 dark:text-blue-200 space-y-1">
                <li>Použiť Google Ads Settings na riadenie reklám</li>
                <li>Nainštalovať AdBlock na blokovanie reklám</li>
                <li>Odmietnuť cookies v nastaveniach prehliadača</li>
                <li>Kontaktovať nás s otázkami o reklamách</li>
              </ul>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Cookies a sledovanie</h2>
            <p className="text-muted-foreground mb-4">
              Naša stránka používa cookies a podobné technológie na zlepšenie vašej skúsenosti 
              a analýzu návštevnosti.
            </p>

            <h3 className="text-lg font-semibold text-foreground mb-3">Typy cookies, ktoré používame:</h3>
            
            <div className="space-y-4">
              <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Nevyhnutné cookies</h4>
                <p className="text-muted-foreground text-sm">
                  Potrebné pre základné fungovanie stránky. Bez nich stránka nebude fungovať správne.
                </p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Analytické cookies</h4>
                <p className="text-muted-foreground text-sm">
                  Pomáhajú nám pochopiť, ako návštevníci používajú stránku. Používame Google Analytics.
                </p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Reklamné cookies</h4>
                <p className="text-muted-foreground text-sm">
                  Používajú sa na zobrazovanie relevantných reklám. Spravuje ich Google AdSense.
                </p>
              </div>
            </div>

            {/* Detailed Cookie List */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Detailný zoznam cookies</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-3 text-left text-sm font-semibold text-foreground">Názov cookie</th>
                      <th className="border border-border p-3 text-left text-sm font-semibold text-foreground">Účel</th>
                      <th className="border border-border p-3 text-left text-sm font-semibold text-foreground">Doba platnosti</th>
                      <th className="border border-border p-3 text-left text-sm font-semibold text-foreground">Typ</th>
                      <th className="border border-border p-3 text-left text-sm font-semibold text-foreground">Poskytovateľ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Necessary Cookies */}
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">google-consent</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Ukladá vaše nastavenia súhlasu s cookies</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">365 dní</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Prvá strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Infinite.sk</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">session-id</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Identifikácia používateľa počas relácie</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Do zatvorenia prehliadača</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Prvá strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Infinite.sk</td>
                    </tr>
                    
                    {/* Google Analytics Cookies */}
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">_ga</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Rozlíšenie používateľov</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">2 roky</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google Analytics</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">_ga_*</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Ukladanie stavu relácie</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">2 roky</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google Analytics</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">_gid</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Rozlíšenie používateľov</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">24 hodín</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google Analytics</td>
                    </tr>
                    
                    {/* Google AdSense Cookies */}
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">__gads</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Meranie výkonnosti reklám</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">13 mesiacov</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google AdSense</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">__gpi</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Personalizácia reklám</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">13 mesiacov</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google AdSense</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">IDE</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Zobrazovanie relevantných reklám</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">13 mesiacov</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google DoubleClick</td>
                    </tr>
                    <tr>
                      <td className="border border-border p-3 text-sm text-foreground font-mono">test_cookie</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Testovanie podpory cookies</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">15 minút</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Tretia strana</td>
                      <td className="border border-border p-3 text-sm text-muted-foreground">Google DoubleClick</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Ako spravovať cookies</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Môžete spravovať svoje nastavenia cookies pomocou:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Nastavenia cookies na našej stránke (tlačidlo nastavení v pravom dolnom rohu)</li>
                  <li>Nastavenia vášho prehliadača (Chrome, Firefox, Safari, Edge)</li>
                  <li>Google Ads Settings pre reklamné cookies</li>
                  <li>Google Analytics Opt-out pre analytické cookies</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Zhromažďované údaje */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Aké údaje zhromažďujeme</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Automaticky zhromažďované údaje:</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>IP adresa a geografická poloha</li>
                  <li>Typ prehliadača a operačného systému</li>
                  <li>Stránky, ktoré navštívite na našej stránke</li>
                  <li>Čas a dĺžka návštevy</li>
                  <li>Odkazy, z ktorých ste na stránku prišli</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Údaje, ktoré nám dobrovoľne poskytnete:</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Emailová adresa (ak sa prihlásite k odberu noviniek)</li>
                  <li>Komentáre a spätná väzba</li>
                  <li>Kontaktné údaje (ak nás kontaktujete)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Účel spracovania */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Prečo spracovávame vaše údaje</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">Legitímny záujem</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Analýza návštevnosti stránky</li>
                  <li>• Zlepšovanie obsahu a funkcionality</li>
                  <li>• Technická podpora a bezpečnosť</li>
                </ul>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">Súhlas</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Marketingové komunikácie</li>
                  <li>• Personalizované reklamy</li>
                  <li>• Cookies pre analýzu</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Vaše práva */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Vaše práva podľa GDPR</h2>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200 mb-4">
                Máte nasledujúce práva týkajúce sa vašich osobných údajov:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo na prístup</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete požiadať o informácie o tom, aké údaje o vás máme.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo na opravu</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete požiadať o opravu nesprávnych údajov.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo na vymazanie</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete požiadať o vymazanie vašich údajov.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo na obmedzenie</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete požiadať o obmedzenie spracovania údajov.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo na prenosnosť</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete požiadať o prenos vašich údajov.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Právo namietať</h4>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Môžete namietať proti spracovaniu vašich údajov.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Zdieľanie údajov */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Zdieľanie údajov s tretími stranami</h2>
            <p className="text-muted-foreground mb-4">
              Vaše údaje môžeme zdieľať s nasledujúcimi tretími stranami:
            </p>
            <div className="space-y-3">
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-1">Google LLC</h3>
                <p className="text-sm text-muted-foreground">
                  Pre Google Analytics a Google AdSense. Viac informácií: 
                  <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline ml-1">
                    Google Privacy Policy
                  </a>
                </p>
              </div>
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-1">Poskytovatelia hostingových služieb</h3>
                <p className="text-sm text-muted-foreground">
                  Pre technické zabezpečenie prevádzky stránky.
                </p>
              </div>
            </div>
          </section>

          {/* Bezpečnosť */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Bezpečnosť údajov</h2>
            <p className="text-muted-foreground mb-4">
              Implementujeme vhodné technické a organizačné opatrenia na ochranu vašich údajov:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Šifrovanie údajov pri prenose (HTTPS)</li>
              <li>Pravidelné bezpečnostné aktualizácie</li>
              <li>Obmedzený prístup k údajom len pre oprávnené osoby</li>
              <li>Pravidelné zálohovanie a monitoring</li>
            </ul>
          </section>

          {/* Kontakt */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Kontakt a sťažnosti</h2>
            <div className="bg-muted p-6 rounded-lg">
              <p className="text-muted-foreground mb-4">
                Ak máte otázky týkajúce sa ochrany údajov alebo chcete uplatniť svoje práva, 
                kontaktujte nás:
              </p>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  <strong>Email:</strong> info@infinite.sk
                </p>
                <p className="text-muted-foreground">
                  <strong>Predmet:</strong> Ochrana údajov - [Vaša otázka]
                </p>
              </div>
              <p className="text-muted-foreground mt-4 text-sm">
                Môžete sa tiež obrátiť na Úrad na ochranu osobných údajov SR, 
                ak sa domnievate, že vaše práva boli porušené.
              </p>
            </div>
          </section>

          {/* Zmeny */}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Zmeny v zásadách ochrany údajov</h2>
            <p className="text-muted-foreground">
              Tieto zásady môžeme čas od času aktualizovať. O významných zmenách vás budeme 
              informovať prostredníctvom oznámenia na stránke alebo emailom. Odporúčame vám 
              pravidelne kontrolovať túto stránku.
            </p>
          </section>
        </div>

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Ochrana údajov | Infinite",
              "description": "Informácie o ochrane osobných údajov, cookies a reklamách na Infinite.sk",
              "url": `${SITE_CONFIG.url}/ochrana-udajov`,
              "isPartOf": {
                "@type": "WebSite",
                "name": "Infinite",
                "url": SITE_CONFIG.url
              },
              "dateModified": new Date().toISOString(),
              "inLanguage": "sk-SK"
            })
          }}
        />
      </div>
    </div>
  )
}
