'use client'

import Image from 'next/image'
import { Cross, Book, Heart, Users, Church, Globe } from 'lucide-react'
import { ParallaxHero } from '@/components/ui/ParallaxHero'
import { ImageTextSection } from '@/components/ui/ImageTextSection'
import { WorshipGrid } from '@/components/about/WorshipGrid'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'

const beliefs = [
  {
    icon: Cross,
    title: 'The Holy Trinity',
    description: 'One God in three persons — Father, Son, and Holy Spirit.',
  },
  {
    icon: Heart,
    title: 'The Incarnation',
    description: 'Jesus Christ is fully God and fully man, united in one nature.',
  },
  {
    icon: Book,
    title: 'Sacred Scripture & Tradition',
    description: 'The Bible and the teachings of the Church Fathers guide our faith.',
  },
  {
    icon: Church,
    title: 'The Seven Sacraments',
    description: 'Baptism, Chrismation, Eucharist, Confession, Unction, Matrimony, and Priesthood.',
  },
  {
    icon: Users,
    title: 'The Communion of Saints',
    description: 'We honor those who lived faithfully and ask for their prayers.',
  },
  {
    icon: Globe,
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
        as Holy Scripture lived within Holy Tradition — the apostolic teaching,
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
    <section className="section-padding bg-gray-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-50 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl opacity-60 translate-y-1/2 -translate-x-1/2" />

      {/* Decorative cross watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
        <Image src="/images/CC3.png" alt="" width={400} height={400} className="w-96 h-96" />
      </div>

      <div className="container-custom relative z-10">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <span className="inline-block w-12 h-1 bg-gold rounded-full" />
          </div>
          <h2 className="font-serif text-heading-1 md:text-display-2 text-gray-900 text-balance">
            What We Believe
          </h2>
          <p className="mt-4 text-body-lg text-gray-600 max-w-2xl mx-auto">
            The core tenets of the Orthodox Christian faith
          </p>
        </div>

        <div
          ref={ref}
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto ${isVisible ? 'stagger-children' : ''}`}
        >
          {beliefs.map((belief) => {
            const Icon = belief.icon
            return (
              <div
                key={belief.title}
                className="bg-white rounded-xl p-6 shadow-soft border-t-2 border-gold hover-lift"
              >
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-900" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-gray-900 mb-2">
                  {belief.title}
                </h3>
                <p className="text-gray-600 text-body-sm">
                  {belief.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ComparisonSection() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section className="section-padding bg-gray-50">
      <div className="container-custom">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <span className="inline-block w-12 h-1 bg-gold rounded-full" />
            </div>
            <h2 className="font-serif text-heading-1 md:text-display-2 text-gray-900 text-balance">
              How Are We Different?
            </h2>
          </div>

          <div
            ref={ref}
            className={`space-y-6 ${isVisible ? 'stagger-children' : ''}`}
          >
            {comparisons.map((comparison) => (
              <div
                key={comparison.title}
                className="bg-white rounded-xl p-8 shadow-soft border-l-4 border-l-primary-900 hover-lift"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Image src="/images/CC5.png" alt="" width={20} height={20} className="w-5 h-5 opacity-40" />
                  <h3 className="font-serif text-heading-4 text-primary-900">
                    {comparison.title}
                  </h3>
                </div>
                {comparison.content}
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
