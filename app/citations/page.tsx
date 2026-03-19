import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Citations & Sources — Internal Reference',
  description: 'Internal reference page documenting the authoritative Coptic Orthodox sources for the What is the Coptic Orthodox Church page.',
  robots: 'noindex, nofollow',
}

const sections = [
  {
    id: 'what-we-believe',
    label: 'Section 1',
    heading: 'What We Believe — The Ancient Faith',
    page: '/about/coptic-orthodoxy',
    entries: [
      {
        belief: 'The Holy Trinity',
        siteText: 'One God in three persons: Father, Son, and Holy Spirit.',
        source: 'copticchurch.net — Theology Overview',
        url: 'https://www.copticchurch.net/theology',
        quote: null,
        matchQuality: 'Moderate',
        notes:
          'Standard Nicene Creed language universally affirmed by the Coptic Orthodox Church. No single page contains this condensed phrasing verbatim — the theology index lists "The Meaning of the Holy Trinity" by Heg. Fr. Abraam Sleman as an article on this doctrine.',
      },
      {
        belief: 'The Incarnation',
        siteText: 'Jesus Christ is fully God and fully man, united in one nature.',
        source: 'St. Takla — Nature of Christ (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/nature-of-christ/orthodox-concept.html',
        quote:
          '"God Himself, the Incarnate Logos Who took to Himself a perfect manhood. His Divine nature is one with his human nature yet without mingling, confusion or alteration; a complete Hypostatic Union."',
        matchQuality: 'High',
        notes:
          'The condensed phrasing "fully God and fully man, united in one nature" is an editorial synthesis of this source. The 1988 Agreed Statement (see VS. Eastern Orthodox below) is the most authoritative verbatim expression of this doctrine.',
      },
      {
        belief: 'Sacred Scripture & Tradition',
        siteText: 'The Bible and the teachings of the Church Fathers guide our faith.',
        source: 'St. Takla — Comparative Theology: Tradition (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/comparative-theology/tradition.html',
        quote:
          '"Tradition is every teaching, other than the words of the Holy Bible, that was entrusted to us, by the Apostles and the Fathers."',
        matchQuality: 'High',
        notes:
          'The site text is a condensed paraphrase. The source also explains that Protestants "do not believe in Tradition. They only abide by the Holy Bible," which forms the basis of the VS. Protestant section.',
      },
      {
        belief: 'The Seven Sacraments',
        siteText:
          'Baptism, Chrismation, Eucharist, Confession, Unction, Matrimony, and Priesthood.',
        source: 'copticchurch.net — Introduction to the Coptic Church',
        url: 'https://www.copticchurch.net/introduction-to-the-coptic-church',
        quote:
          'Lists all seven: Sacrament of Baptism, Sacrament of Confirmation (Chrismation), Sacrament of Holy Eucharist, Sacrament of Repentance & Confession, Sacrament of Unction of the Sick, Sacrament of Holy Matrimony, Sacrament of Priesthood.',
        matchQuality: 'Very High',
        notes:
          'Near-verbatim. Note: copticchurch.net uses "Confirmation" while our site uses "Chrismation" — both refer to the same sacrament. St. Takla also lists all seven at: https://st-takla.org/FAQ-Questions-VS-Answers/03-Questions-Related-to-Theology-and-Dogma__Al-Lahoot-Wal-3akeeda/021-The-Seven-Holy-Sacraments.html',
      },
      {
        belief: 'The Communion of Saints',
        siteText: 'We honor those who lived faithfully and ask for their prayers.',
        source: 'St. Takla — Comparative Theology: Mediation & Intercession (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/comparative-theology/mediation-intercession.html',
        quote:
          '"Saints\' intercession is merely praying for us; they are of the pleading type, which is completely different to Christ\'s atoning mediation." Also: "if we ask living believers to pray for us, why deny this to saints who have completed their spiritual journey and dwell with Christ?"',
        matchQuality: 'High',
        notes: 'Site text is a condensed paraphrase of this source.',
      },
      {
        belief: 'Apostolic Succession',
        siteText: 'An unbroken line of bishops going back to the Apostles.',
        source: 'copticchurch.net — Introduction to the Coptic Church',
        url: 'https://www.copticchurch.net/introduction-to-the-coptic-church',
        quote:
          '"The Copts are proud of the apostolicity of their church, whose founder is St. Mark, one of the seventy Apostles and one of the four Evangelists. He is regarded by the Coptic hierarchy as the first of their unbroken 118 patriarchs."',
        matchQuality: 'Very High',
        notes: 'The unbroken succession is explicitly stated here.',
      },
    ],
  },
  {
    id: 'divine-liturgy',
    label: 'Section 2',
    heading: 'How We Worship — The Divine Liturgy',
    page: '/about/coptic-orthodoxy',
    entries: [
      {
        belief: 'Three languages of worship (English, Arabic, Coptic)',
        siteText:
          'Services are conducted in English, Arabic, and Coptic, the language of ancient Egypt, descended from the pharaohs, connecting us to the earliest Christians.',
        source: 'copticchurch.net — Liturgy',
        url: 'https://www.copticchurch.net/liturgy',
        quote: '"Listen to various Coptic Liturgies from many different Coptic Churches in English, Arabic, and Coptic."',
        matchQuality: 'Very High',
        notes: 'Exact three languages confirmed verbatim.',
      },
      {
        belief: 'Coptic as the language of ancient Egypt / pharaohs',
        siteText: 'Coptic, the language of ancient Egypt, descended from the pharaohs',
        source: 'copticchurch.net — Coptic Language',
        url: 'https://www.copticchurch.net/coptic_language',
        quote:
          '"Coptic is the language of the Copts, the indigenous Egyptian Christians which represents the final stage of the ancient Egyptian language."',
        matchQuality: 'Very High',
        notes: '"Final stage of the ancient Egyptian language" directly supports the pharaonic connection claim.',
      },
      {
        belief: 'Liturgy traced to the apostolic age',
        siteText: 'Every gesture, word, and chant carries the weight of two thousand years.',
        source: 'St. Takla — Coptic Church Overview',
        url: 'https://st-takla.org/Coptic-church-1.html',
        quote:
          '"The Liturgy of Saint Basil is most commonly used. Saint Cyril\'s liturgy preserves elements from the one that Saint Mark used (in Greek) in the first century."',
        matchQuality: 'High',
        notes:
          'The poetic phrasing ("two thousand years") is editorial. The apostolic-age origin is directly supported by this source. Also confirmed by orthodoxwiki.org/Coptic_Orthodox_Church.',
      },
      {
        belief: 'Ancient hymns and liturgical music unchanged since the early Church',
        siteText: 'Ancient Hymns — Unchanged since the early Church',
        source: 'Tasbeha.org — "Coptic Hymns" (Coptic Orthodox Church of St. Mark, Jersey City, NJ)',
        url: 'https://tasbeha.org/content/articles/coptic_hymns.php',
        quote:
          '"The hymns represent a valuable inheritance, which dates back to the apostolic age unchanged. Thus are regarded as part of the Church\'s Sacraments and a living gift, which could be obtained through learning." Also: "Historical evidence suggests that the Coptic hymns existed since the Apostolic ages. It was formulated and formalised during the foundation of the Coptic Church. Contrary to the western churches whose hymns were developed with time, the Coptic hymns remained unchanged."',
        matchQuality: 'Very High',
        notes:
          'Tasbeha.org is the primary Coptic Orthodox digital resource for hymns and liturgy — copticchurch.net links out to it for hymns content. The article draws on the Deacon\'s Service Book (Coptic), the Ebsalmodia, and the Coptic Theology College in Cairo. The core quote also appears as a site summary at: https://tasbeha.org/mp3/Hymns.html. Additional direct quote: "The Coptic hymns began to develop shortly after the preaching of St Mark the Apostle in Alexandria."',
      },
    ],
  },
  {
    id: 'distinctions',
    label: 'Section 3',
    heading: 'How Are We Different? — Distinctions',
    page: '/about/coptic-orthodoxy',
    entries: [
      {
        belief: 'VS. Roman Catholicism — Independence since Chalcedon 451 AD',
        siteText:
          'The Coptic Church has been independent since the Council of Chalcedon in 451 AD. We are not under the Pope of Rome, though we share many beliefs.',
        source: 'OrthodoxWiki — Coptic Orthodox Church',
        url: 'https://orthodoxwiki.org/Coptic_Orthodox_Church',
        quote:
          '"The church broke from the Byzantine churches in the wake of the Fourth Ecumenical Council in Chalcedon in 451." Also: "A small Coptic Catholic Church (Eastern Rite Catholic) exists in communion with the Pope of Rome" — implying the main Coptic Orthodox Church is not.',
        matchQuality: 'High',
        notes: 'Concept and date directly confirmed.',
      },
      {
        belief: 'VS. Roman Catholicism — Papal authority / no papal infallibility',
        siteText:
          'In the Coptic understanding, the Pope of Alexandria is the head of the church as "head among equals," and doctrine is safeguarded by the Holy Synod rather than through a claim of universal papal supremacy or papal infallibility.',
        source: 'St. Takla — Coptic Church Overview',
        url: 'https://st-takla.org/Coptic-church-1.html',
        quote:
          '"The Pope of the Coptic Church, although highly regarded by all Copts, does not enjoy any state of supremacy or infallibility."',
        matchQuality: 'Very High',
        notes:
          'Near-verbatim match. The "head among equals" and "Holy Synod" phrasing is an editorial synthesis consistent with this source. Also covered (in Arabic) at: https://st-takla.org/FAQ-Questions-VS-Answers/03-Questions-Related-to-Theology-and-Dogma__Al-Lahoot-Wal-3akeeda/045-Difference-between-Orthodox-and-Catholic.html',
      },
      {
        belief: 'VS. Protestant Churches — Scripture within Tradition, not Bible alone',
        siteText:
          'The Coptic Orthodox Church understands the Christian faith as Holy Scripture lived within Holy Tradition, specifically the apostolic teaching, worship, and life of the Church that preserves and interprets the Bible, rather than treating "Bible alone" as the sole authority.',
        source: 'St. Takla — Comparative Theology: Tradition (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/comparative-theology/tradition.html',
        quote:
          '"Tradition is every teaching, other than the words of the Holy Bible, that was entrusted to us, by the Apostles and the Fathers." Protestants "do not believe in Tradition. They only abide by the Holy Bible," excluding "the writings of the Apostles and Fathers of the Church, the decisions of the holy councils, the Church Canons and regulations, the Church rituals and the oral Tradition."',
        matchQuality: 'High',
        notes:
          'Site text is an editorial synthesis. The phrase "apostolic teaching" echoes Pope Shenouda\'s definition of Tradition. See also: https://st-takla.org/books/en/pope-shenouda-iii/comparative-theology/protestants.html',
      },
      {
        belief: 'VS. Protestant Churches — Seven sacraments and veneration of saints',
        siteText:
          'We also keep an unbroken sacramental (mysteries) life in the Church, including the Holy Eucharist, repentance and confession, and the priesthood, as part of the seven sacraments Christ established for His Church. And we venerate the Virgin Mary and the saints (honor and asking for their prayers), while worship belongs to God alone.',
        source: 'St. Takla — Comparative Theology: Mediation & Intercession (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/comparative-theology/mediation-intercession.html',
        quote:
          '"Saints\' intercession is merely praying for us; they are of the pleading type, which is completely different to Christ\'s atoning mediation."',
        matchQuality: 'Very High',
        notes:
          'Directly supports the distinction between veneration (honor + asking for prayers) and worship. The FAQ page also covers Protestant rejection of sacraments in Arabic: https://st-takla.org/FAQ-Questions-VS-Answers/03-Questions-Related-to-Theology-and-Dogma__Al-Lahoot-Wal-3akeeda/072-Disagreement-with-Protestant.html',
      },
      {
        belief: 'VS. Eastern Orthodox — Chalcedon split (451 AD)',
        siteText:
          'While we share much with the Eastern Orthodox (apostolic succession, sacramental life, and the faith of the early Church), we have been separate since the Council of Chalcedon (451 AD).',
        source: 'OrthodoxWiki — Oriental Orthodox Churches',
        url: 'https://orthodoxwiki.org/Oriental_Orthodox_Churches',
        quote:
          '"keep the faith of only the first three Ecumenical Councils and rejected the dogmatic definitions of the Council of Chalcedon (A.D. 451)." Also: "dialogues...revealed that both communions now share a common Christology with differing terminology."',
        matchQuality: 'Very High',
        notes: 'Directly confirms the Chalcedon split date and shared theological ground.',
      },
      {
        belief: 'VS. Eastern Orthodox — Christology: Miaphysis, rejecting Nestorius and Eutyches',
        siteText:
          'The Oriental Orthodox did not accept Chalcedon\'s "in two natures" wording, and instead confess the formula of St Cyril of Alexandria: "One Incarnate Nature of God the Logos" (Miaphysis), while rejecting both Nestorian division and Eutychian "monophysitism."',
        source: 'St. Takla — Nature of Christ: Agreed Statement (Pope Shenouda III)',
        url: 'https://st-takla.org/books/en/pope-shenouda-iii/nature-of-christ/agreed-statement.html',
        quote:
          '"We believe that our Lord, God and Saviour Jesus Christ, the Incarnate-Logos is perfect in His Divinity and perfect in His Humanity. He made His humanity One with His Divinity without Mixture, nor Mingling, nor Confusion. His Divinity was not separated from His Humanity even for a moment or twinkling of an eye. At the same time, we anathematize the Doctrines of both Nestorius and Eutyches." — 1988 Agreed Statement on Christology',
        matchQuality: 'Very High',
        notes:
          'This is the single most authoritative source for the VS. Eastern Orthodox section. The anathematization of both Nestorius and Eutyches is explicitly stated. St. Cyril\'s formula is documented at: https://st-takla.org/books/en/pope-shenouda-iii/nature-of-christ/orthodox-concept.html — "One Nature of God the Incarnate Logos (Mia Physis Tou Theou Logou Sesarkwmene)"',
      },
      {
        belief: 'VS. Eastern Orthodox — Miaphysitism explained',
        siteText: 'The core disagreement was Christology, specifically how to express the unity of Christ\'s divinity and humanity.',
        source: 'OrthodoxWiki — Miaphysitism',
        url: 'https://orthodoxwiki.org/Miaphysitism',
        quote:
          '"in the one person of Jesus Christ, Divinity and Humanity are united in one nature (physis), the two being united without separation, without confusion, and without alteration." Also: "the incarnate Christ has one nature, but that nature is of the two natures, divine and human, and retains all the characteristics of both."',
        matchQuality: 'Very High',
        notes:
          'Directly explains the Miaphysite position and why it differs from both Nestorianism and Eutychian monophysitism. Confirms that Miaphysites reject the "Monophysite" label.',
      },
    ],
  },
]

const qualityColor: Record<string, string> = {
  'Very High': 'bg-emerald-100 text-emerald-800',
  High: 'bg-blue-100 text-blue-800',
  Moderate: 'bg-amber-100 text-amber-800',
  Low: 'bg-red-100 text-red-800',
}

export default function CitationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-widest uppercase text-gray-400 mb-2">Internal Reference — Not Indexed</p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4">Citations & Sources</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Authoritative Coptic Orthodox sources for the{' '}
            <a href="/about/coptic-orthodoxy" className="underline text-white hover:text-gray-300">
              What is the Coptic Orthodox Church?
            </a>{' '}
            page. Generated March 2026.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors"
              >
                {s.label}: {s.heading.split('—')[0].trim()}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {sections.map((section) => (
          <div key={section.id} id={section.id}>
            {/* Section heading */}
            <div className="border-b-2 border-gray-900 pb-3 mb-8">
              <span className="text-xs tracking-widest uppercase text-gray-400 font-medium">{section.label}</span>
              <h2 className="font-serif text-2xl md:text-3xl text-gray-900 mt-1">{section.heading}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Page: <a href={section.page} className="underline hover:text-gray-700">{section.page}</a>
              </p>
            </div>

            {/* Entries */}
            <div className="space-y-8">
              {section.entries.map((entry, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {/* Entry header */}
                  <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{entry.belief}</h3>
                      <p className="text-sm text-gray-500 mt-0.5 italic">&ldquo;{entry.siteText}&rdquo;</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${qualityColor[entry.matchQuality]}`}>
                      {entry.matchQuality} match
                    </span>
                  </div>

                  {/* Entry body */}
                  <div className="px-6 py-5 space-y-4">
                    {/* Source */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">Source</p>
                      <p className="font-medium text-gray-800">{entry.source}</p>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-700 hover:underline break-all"
                      >
                        {entry.url}
                      </a>
                    </div>

                    {/* Quote */}
                    {entry.quote && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">Key Quote</p>
                        <blockquote className="border-l-4 border-gray-300 pl-4 text-gray-700 italic text-sm leading-relaxed">
                          {entry.quote}
                        </blockquote>
                      </div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">Notes</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{entry.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div className="border-t border-gray-300 pt-8 text-sm text-gray-500 space-y-2">
          <p><strong>Note on match quality:</strong> "Very High" = near-verbatim text found on source page. "High" = concept directly documented, phrasing is an editorial synthesis. "Moderate" = general doctrinal alignment, no close phrasing match.</p>
          <p><strong>Primary sources:</strong> St. Takla (st-takla.org) — Pope Shenouda III book series. copticchurch.net — official introductory content. OrthodoxWiki — Coptic Orthodox Church, Oriental Orthodox Churches, Miaphysitism articles.</p>
          <p className="text-gray-400">This page is excluded from search engine indexing (noindex, nofollow). It is not linked from any public navigation.</p>
        </div>
      </div>
    </div>
  )
}
