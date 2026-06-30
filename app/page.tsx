import Link from "next/link";

const heroCards = [
  { title: "夜が明けるまで", artist: "ミナミ", completion: 88, color: "#c8f23d" },
  { title: "アスファルトの花", artist: "Kento Rui", completion: 92, color: "#3dc8f2" },
  { title: "波と風と", artist: "海音", completion: 81, color: "#f23d8c" },
];

const features = [
  {
    title: "熱量で分配",
    desc: "再生数ではなく、応援率・完聴率・リピート率から算出した「熱量」で収益を分配します。",
  },
  {
    title: "計算式を常時公開",
    desc: "分配の計算式はパブリックページで常時公開。アーティストは自分のスコアを検証できます。",
  },
  {
    title: "相性で発見する",
    desc: "知名度ではなく、聴く人との相性で音楽と出会う発見性の設計。",
  },
  {
    title: "感謝を返せる設計",
    desc: "感動した人が任意で応援できる、強制ではない投げ銭の仕組み。",
  },
];

const plans = [
  {
    name: "Free",
    tag: "まずは無料で",
    price: "¥0",
    features: ["月15時間まで再生", "広告あり"],
    featured: false,
    cta: "無料で始める",
    href: "/register",
  },
  {
    name: "Standard",
    tag: "いちばん人気",
    price: "¥750",
    features: ["無制限再生", "広告なし", "応援・投げ銭"],
    featured: true,
    cta: "Standardで始める",
    href: "/register",
  },
  {
    name: "Support+",
    tag: "アーティストを支える",
    price: "¥1,000",
    features: ["高音質再生", "応援ボーナス", "月間投げ銭手数料3.6%"],
    featured: false,
    cta: "Support+で始める",
    href: "/register",
  },
];

const artistTiles = [
  { name: "ミナミ", genre: "Lo-fi / Bedroom Pop", color: "#c8f23d" },
  { name: "Kento Rui", genre: "Alternative Rock", color: "#3dc8f2" },
  { name: "海音", genre: "Ambient / Folk", color: "#f23d8c" },
  { name: "ヨル猫", genre: "City Pop", color: "#f2c83d" },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-bold tracking-tight">
            RESON
          </span>
          <nav className="hidden gap-8 text-sm text-[var(--dim)] sm:flex">
            <a href="#about" className="hover:text-[var(--text)]">思想</a>
            <a href="#pricing" className="hover:text-[var(--text)]">料金</a>
            <a href="#artists" className="hover:text-[var(--text)]">アーティスト</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--dim)] hover:text-[var(--text)]">
              ログイン
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:opacity-90"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:grid-cols-2 sm:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              聴くことが、そのまま
              <span className="text-[var(--accent)]">音楽文化</span>
              を育てる。
            </h1>
            <p className="mt-6 text-base leading-7 text-[var(--dim)]">
              RESONは再生数ではなく「熱量」（応援率・完聴率・リピート率）で収益を分配するサブスクです。
              知名度ではなく相性で音楽と出会い、感動した人が任意で感謝を返せる仕組みを目指しています。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:opacity-90"
              >
                音楽を聴く
              </Link>
              <a
                href="#about"
                className="rounded-full border border-[var(--line-md)] px-6 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
              >
                仕組みを見る
              </a>
            </div>
            <p className="mt-4 text-xs text-[var(--faint)]">クレジットカード不要・登録は1分</p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="mb-3 text-xs font-medium text-[var(--faint)]">熱量が高まっている楽曲</p>
            <ul className="flex flex-col gap-3">
              {heroCards.map((c) => (
                <li
                  key={c.title}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                >
                  <span
                    className="h-12 w-12 shrink-0 rounded-lg"
                    style={{ backgroundColor: c.color }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-[var(--dim)]">{c.artist}</p>
                  </div>
                  <span className="text-xs text-[var(--faint)]">完聴率 {c.completion}%</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="mt-4 block text-center text-xs text-[var(--dim)] hover:text-[var(--text)]"
            >
              すべての楽曲を見る →
            </Link>
          </div>
        </section>

        <section id="about" className="border-t border-[var(--line)] bg-[var(--panel)] px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display max-w-2xl text-3xl font-bold leading-tight">
              上位1%より、99%が報われる設計。
            </h2>
            <div className="mt-6 max-w-2xl space-y-4 text-sm leading-7 text-[var(--dim)]">
              <p>
                既存サービスは再生数の上位アーティストに収益が集中しがちです。RESONは熱量スコア（再生時間・応援率・完聴率）で分配することで、知名度のないインディーズ・新人アーティストにもチャンスが生まれる構造を意図しています。
              </p>
              <p>分配の計算式はすべて公開されており、アーティストは自分のスコアと収益を自分で検証できます。</p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                  <h3 className="font-display text-base font-bold text-[var(--accent)]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--dim)]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-bold">料金プラン</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    p.featured
                      ? "border-[var(--accent)] bg-[var(--surface)]"
                      : "border-[var(--line)] bg-[var(--panel)]"
                  }`}
                >
                  <p className="text-xs font-medium text-[var(--faint)]">{p.tag}</p>
                  <h3 className="font-display mt-1 text-xl font-bold">{p.name}</h3>
                  <p className="mt-4 text-3xl font-bold">
                    {p.price}
                    <span className="text-sm font-normal text-[var(--dim)]">/月</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm text-[var(--dim)]">
                    {p.features.map((f) => (
                      <li key={f}>・{f}</li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    className={`mt-6 rounded-full px-5 py-3 text-center text-sm font-semibold transition ${
                      p.featured
                        ? "bg-[var(--accent)] text-[var(--ink)] hover:opacity-90"
                        : "border border-[var(--line-md)] text-[var(--text)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-[var(--faint)]">
              中高生の方は Student プラン（¥250・.ed.jp認証）もご利用いただけます。
            </p>
          </div>
        </section>

        <section id="artists" className="border-t border-[var(--line)] bg-[var(--panel)] px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-2 sm:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight">
                アーティストのあなたへ。
              </h2>
              <p className="mt-6 text-sm leading-7 text-[var(--dim)]">
                累計100再生を超えると分配対象になります。計算式はすべて公開されているので、自分のスコアと収益を自分で検証できます。
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:opacity-90"
                >
                  アーティスト登録
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-[var(--line-md)] px-6 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--accent)]"
                >
                  分配の仕組みを読む
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {artistTiles.map((a) => (
                <div key={a.name} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
                  <span
                    className="block h-16 w-16 rounded-lg"
                    style={{ backgroundColor: a.color }}
                  />
                  <p className="mt-3 text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-[var(--dim)]">{a.genre}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-display text-sm font-bold">RESON</span>
          <nav className="flex gap-6 text-xs text-[var(--dim)]">
            <a href="#about" className="hover:text-[var(--text)]">思想</a>
            <a href="#pricing" className="hover:text-[var(--text)]">料金</a>
            <a href="#artists" className="hover:text-[var(--text)]">アーティスト</a>
          </nav>
          <p className="text-xs text-[var(--faint)]">© {new Date().getFullYear()} RESON</p>
        </div>
      </footer>
    </div>
  );
}
