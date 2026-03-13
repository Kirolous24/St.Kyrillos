'use client'

import { ParallaxHero } from '@/components/ui/ParallaxHero'
import { ImageTextSection } from '@/components/ui/ImageTextSection'
import { WorshipGrid } from '@/components/about/WorshipGrid'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

const beliefs = [
  {
    title: 'The Holy Trinity',
    description: 'One God in three persons: Father, Son, and Holy Spirit.',
  },
  {
    title: 'The Incarnation',
    description: 'Jesus Christ is fully God and fully man, united in one nature.',
  },
  {
    title: 'Sacred Scripture & Tradition',
    description: 'The Bible and the teachings of the Church Fathers guide our faith.',
  },
  {
    title: 'The Seven Sacraments',
    description: 'Baptism, Chrismation, Eucharist, Confession, Unction, Matrimony, and Priesthood.',
  },
  {
    title: 'The Communion of Saints',
    description: 'We honor those who lived faithfully and ask for their prayers.',
  },
  {
    title: 'Apostolic Succession',
    description: 'An unbroken line of bishops going back to the Apostles.',
  },
]

const comparisons = [
  {
    title: 'From Roman Catholicism',
    content: (
      <p className="text-gray-600">
        The Coptic Church has been independent since the <strong className="text-gray-900">Council of
        Chalcedon</strong> in <strong className="text-gray-900">451 AD</strong>. We are not under the Pope of Rome, though
        we share many beliefs. Our Pope (the Pope of Alexandria) leads
        our church and holds the title &ldquo;Pope&rdquo;. In the Coptic understanding,
        the Pope of Alexandria is the head of the church as &ldquo;head among equals,&rdquo;
        and doctrine is safeguarded by the Holy Synod rather than through
        a claim of universal papal supremacy or papal infallibility.
      </p>
    ),
  },
  {
    title: 'From Protestant Churches',
    content: (
      <p className="text-gray-600">
        The Coptic Orthodox Church understands the Christian faith
        as Holy Scripture lived within Holy Tradition, specifically the apostolic teaching,
        worship, and life of the Church that preserves and interprets the Bible,
        rather than treating &ldquo;Bible alone&rdquo; as the sole authority.
        We also keep an unbroken sacramental (mysteries) life in the Church,
        including the Holy Eucharist, repentance and confession, and the priesthood,
        as part of the seven sacraments Christ established for His Church.
        And we venerate the Virgin Mary and the saints (honor and asking for their prayers),
        while worship belongs to God alone.
      </p>
    ),
  },
  {
    title: 'From Eastern Orthodox (Greek, Russian, etc.)',
    content: (
      <p className="text-gray-600">
        While we share much with the Eastern Orthodox
        (apostolic succession, sacramental life, and the faith of the early Church),
        we have been separate since the Council of Chalcedon (451 AD). The core disagreement was Christology,
        specifically how to express the unity of Christ&apos;s divinity and humanity. The Oriental Orthodox
        did not accept Chalcedon&apos;s &ldquo;in two natures&rdquo; wording, and instead confess the formula of
        St Cyril of Alexandria: &ldquo;One Incarnate Nature of God the Logos&rdquo; (Miaphysis),
        while rejecting both Nestorian division and Eutychian &ldquo;monophysitism.&rdquo;
      </p>
    ),
  },
]

function IntroductionSection() {
  return (
    <section className="section-padding">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-20">
          {/* Our Origins */}
          <ImageTextSection
            imageSrc="/images/stbishoy.jpg"
            imageAlt="St. Bishoy Monastery in Wadi El-Natroun, Egypt"
            imageCaption="St. Bishoy Monastery, Wadi El-Natroun, Egypt"
            imagePosition="right"
          >
            <h2 className="font-serif text-heading-2 md:text-heading-1 text-gray-900 mb-6">
              Our Origins
            </h2>
            <div className="prose-custom space-y-4">
              <p className="text-lg text-gray-700 leading-relaxed">
                The Coptic Church was established in the name of the Lord Jesus Christ by{' '}
                <strong>St. Mark the Evangelist</strong> in the city of Alexandria around 43 A.D.
                The church adheres to the Nicene Creed. <strong>St. Athanasius</strong> (296-373 A.D.),
                the twentieth Pope of the Coptic Church effectively defended the Doctrine of the
                Lord Jesus Christ&apos;s Divinity at the Council of Nicea in 325 A.D. His affirmation
                of the doctrine earned him the title; &ldquo;Father of Orthodoxy&rdquo; and
                St. Athanasius &ldquo;the Apostolic&rdquo;.
              </p>
              <p>
                The term <strong>&ldquo;Coptic&rdquo;</strong> is derived from the Greek
                &ldquo;Aigyptos&rdquo; meaning &ldquo;Egyptian&rdquo;. When the Arabs arrived in Egypt
                in the seventh century, they called the Egyptians &ldquo;qibt&rdquo;. Thus the Arabic
                word &ldquo;qibt&rdquo; came to mean both &ldquo;Egyptians&rdquo; and &ldquo;Christians&rdquo;.
              </p>
              <p>
                The term <strong>&ldquo;Orthodoxy&rdquo;</strong> here refers to the preservation of the
                &ldquo;Original Faith&rdquo; by the Copts who, throughout the ages, defended the Old Creed
                against the numerous attacks aimed at it.
              </p>
            </div>
          </ImageTextSection>

          {/* Our Faith */}
          <ImageTextSection
            imageSrc="/images/ICON_1.jpg"
            imageAlt="Coptic Orthodox Icon"
            imagePosition="left"
            imageClassName="glow-gold"
          >
            <h2 className="font-serif text-heading-2 md:text-heading-1 text-gray-900 mb-6">
              Our Faith
            </h2>
            <div className="prose-custom space-y-4">
              <p>
                The Coptic Orthodox Church worships the Father, the Son and the Holy Spirit in the
                Oneness of Nature. We believe in One God; Father, Son and Holy Spirit three equal
                Co-Essential and Co-Indwelling Hypostasis (Persons). The Blessed and Holy Trinity is
                our One God. We believe that Lord Jesus Christ, the Only-Begotten of the Father and
                Who is One with Him in Essence is the only Savior of the world.
              </p>
              <p>
                We are <strong>Miaphysites</strong>; There is a difference between the &ldquo;Monophysites&rdquo;
                who believe in just One Single Nature (Divine) of Lord Jesus Christ and the &ldquo;Miaphysites&rdquo;
                who believe in One United Nature or One Composite Nature (Divine &amp; Human) of Lord Jesus Christ.
                We do not believe in just a Single Nature but we do believe in the One Incarnate Nature of the Logos.
              </p>
              <p>
                Less changes have taken place in the Coptic Church than in any other church whether in
                the ritual or doctrine aspects and that the succession of the Coptic Patriarchs, Bishops,
                priests and Deacons has been continuous.
              </p>
            </div>
          </ImageTextSection>
        </div>
      </div>
    </section>
  )
}

function BeliefsSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="py-24 bg-stone-50">
      <div className="container-custom">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-6 mb-16">
            <div className="h-px flex-1 bg-gold/30" />
            <div className="text-center">
              <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-2">The Ancient Faith</p>
              <h2 className="font-serif text-4xl md:text-5xl text-gray-900">What We Believe</h2>
            </div>
            <div className="h-px flex-1 bg-gold/30" />
          </div>

          {/* Beliefs — two-column editorial list */}
          <div
            ref={ref}
            className={`grid grid-cols-1 md:grid-cols-2 gap-0 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {beliefs.map((belief, i) => (
              <div
                key={belief.title}
                className="group flex gap-5 p-8 border-b border-gray-200 last:border-b-0 md:[&:nth-child(odd)]:border-r md:[&:nth-child(even)]:border-r-0"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <span className="font-serif text-2xl text-gold/40 leading-none mt-1 select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-serif text-xl text-gray-900 mb-2 group-hover:text-gold transition-colors duration-300">
                    {belief.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    {belief.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}

function ComparisonSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="py-24 bg-white">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-3">Distinctions</p>
            <h2 className="font-serif text-4xl md:text-5xl text-gray-900">How Are We Different?</h2>
          </div>

          <div
            ref={ref}
            className={`space-y-0 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {comparisons.map((comparison, i) => (
              <div
                key={comparison.title}
                className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0 border-t border-gray-200 last:border-b py-10 md:py-12"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Left label */}
                <div className="mb-4 md:mb-0 md:pr-8">
                  <span className="inline-block text-xs tracking-[0.2em] uppercase text-gold font-semibold mb-1">
                    vs.
                  </span>
                  <h3 className="font-serif text-lg text-gray-900 leading-snug">
                    {comparison.title.replace('From ', '')}
                  </h3>
                </div>

                {/* Right content */}
                <div className="text-gray-600 leading-relaxed text-[0.95rem] md:border-l md:border-gray-200 md:pl-8">
                  {comparison.content}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}

export function CopticOrthodoxyContent() {
  return (
    <>
      <ParallaxHero
        imageSrc="/images/ICON_2.jpg"
        imageAlt="Coptic Orthodox Icon"
        title="What is the Coptic Orthodox Church?"
        subtitle="One of the oldest Christian churches in the world"
        showScrollIndicator={false}
      />

      <IntroductionSection />
      <BeliefsSection />
      <WorshipGrid />
      <ComparisonSection />
    </>
  )
}
