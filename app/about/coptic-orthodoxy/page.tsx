import type { Metadata } from 'next'
import Image from 'next/image'
import { Cross, Book, Heart, Users, Church, Globe } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'What is the Coptic Orthodox Church?',
  description: 'Learn about the Coptic Orthodox Church — one of the oldest Christian churches in the world, founded by St. Mark the Evangelist in Egypt.',
}

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

export default function CopticOrthodoxyPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-32 md:py-48 overflow-hidden">
        <Image
          src="/images/ICON_2.jpg"
          alt="Coptic Orthodox Church"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              What is the Coptic Orthodox Church?
            </h1>
            <p className="text-xl text-white/80">
              One of the oldest Christian churches in the world
            </p>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="prose-custom space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                The Coptic Church was established in the name of the Lord Jesus Christ by{' '}
                <strong>St. Mark the Evangelist</strong> in the city of Alexandria around 43 A.D.
                The church adheres to the Nicene Creed. <strong>St. Athanasius</strong> (296-373 A.D.),
                the twentieth Pope of the Coptic Church effectively defended the Doctrine of the
                Lord Jesus Christ&apos;s Divinity at the Council of Nicea in 325 A.D. His affirmation
                of the doctrine earned him the title; &quot;Father of Orthodoxy&quot; and
                St. Athanasius &quot;the Apostolic&quot;.
              </p>

              <p>
                The term <strong>&quot;Coptic&quot;</strong> is derived from the Greek
                &quot;Aigyptos&quot; meaning &quot;Egyptian&quot;. When the Arabs arrived in Egypt
                in the seventh century, they called the Egyptians &quot;qibt&quot;. Thus the Arabic
                word &quot;qibt&quot; came to mean both &quot;Egyptians&quot; and &quot;Christians&quot;.
              </p>

              <p>
                The term <strong>&quot;Orthodoxy&quot;</strong> here refers to the preservation of the
                &quot;Original Faith&quot; by the Copts who, throughout the ages, defended the Old Creed
                against the numerous attacks aimed at it.
              </p>

              <p>
                The Coptic Orthodox Church worships the Father, the Son and the Holy Spirit in the
                Oneness of Nature. We believe in One God; Father, Son and Holy Spirit three equal
                Co-Essential and Co-Indwelling Hypostasis (Persons). The Blessed and Holy Trinity is
                our One God. We believe that Lord Jesus Christ, the Only-Begotten of the Father and
                Who is One with Him in Essence is the only Savior of the world.
              </p>

              <p>
                We are <strong>Miaphysites</strong>; There is a difference between the &quot;Monophysites&quot;
                who believe in just One Single Nature (Divine) of Lord Jesus Christ and the &quot;Miaphysites&quot;
                who believe in One United Nature or One Composite Nature (Divine &amp; Human) of Lord Jesus Christ.
                We do not believe in just a Single Nature but we do believe in the One Incarnate Nature of the Logos.
              </p>

              <p>
                Less changes have taken place in the Coptic Church than in any other church whether in
                the ritual or doctrine aspects and that the succession of the Coptic Patriarchs, Bishops,
                priests and Deacons has been continuous.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <SectionHeader
            title="What We Believe"
            subtitle="The core tenets of the Orthodox Christian faith"
            withAccent
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {beliefs.map((belief) => (
              <div
                key={belief.title}
                className="bg-white rounded-xl p-6 shadow-soft"
              >
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                  <belief.icon className="w-6 h-6 text-primary-900" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-gray-900 mb-2">
                  {belief.title}
                </h3>
                <p className="text-gray-600 text-body-sm">
                  {belief.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Worship */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              title="How We Worship"
              withAccent
            />

            <div className="prose-custom">
              <p>
                Our worship is <strong>liturgical</strong> — meaning we follow
                ancient prayers, hymns, and rituals passed down through generations.
                The Divine Liturgy (our main Sunday service) includes:
              </p>
              <ul>
                <li>Scripture readings from the Old Testament, Epistles, and Gospels</li>
                <li>Ancient hymns, some unchanged since the early Church</li>
                <li>Incense, symbolizing our prayers rising to God</li>
                <li>The Eucharist (Holy Communion), the center of our worship</li>
              </ul>
              <p>
                Services are conducted in <strong>English, Arabic, and Coptic</strong>
                (the language of ancient Egypt, descended from the pharaohs). The
                Coptic language preserves our ancient heritage and connects us to
                the earliest Christians.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Are We Different */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              title="How Are We Different?"
              withAccent
            />

            <div className="space-y-8">
              {/* From Roman Catholicism */}
              <div className="bg-white rounded-xl p-8 shadow-soft">
                <h3 className="font-serif text-heading-4 text-primary-900 mb-4">
                  From Roman Catholicism
                </h3>
                <p className="text-gray-600">
                  The Coptic Church has been independent since the <strong>Council of
                  Chalcedon</strong> in <strong>451 AD</strong>. We are not under the Pope of Rome, though
                  we share many beliefs. Our Pope (the Pope of Alexandria) leads
                  our church and holds the title "Pope". In the Coptic understanding,
                  the Pope of Alexandria is the head of the church as “head among equals,” 
                  and doctrine is safeguarded by the Holy Synod rather than through 
                  a claim of universal papal supremacy or papal infallibility.  
                </p>
              </div>

              {/* From Protestant Churches */}
              <div className="bg-white rounded-xl p-8 shadow-soft">
                <h3 className="font-serif text-heading-4 text-primary-900 mb-4">
                  From Protestant Churches
                </h3>
                <p className="text-gray-600">
                  The Coptic Orthodox Church understands the Christian faith 
                  as Holy Scripture lived within Holy Tradition the apostolic teaching, 
                  worship, and life of the Church that preserves and interprets the Bible, 
                  rather than treating “Bible alone” as the sole authority.   
                  We also keep an unbroken sacramental (mysteries) life in the Church, 
                  including the Holy Eucharist, repentance and confession, and the priesthood, 
                  as part of the seven sacraments Christ established for His Church.   
                  And we venerate the Virgin Mary and the saints (honor and asking for their prayers), 
                  while worship belongs to God alone.  

                </p>
              </div>

              {/* From Eastern Orthodox */}
              <div className="bg-white rounded-xl p-8 shadow-soft">
                <h3 className="font-serif text-heading-4 text-primary-900 mb-4">
                  From Eastern Orthodox (Greek, Russian, etc.)
                </h3>
                <p className="text-gray-600">
                  While we share much with the Eastern Orthodox 
                  (apostolic succession, sacramental life, and the faith of the early Church),
                  we have been separate since the Council of Chalcedon (451 AD). The core disagreement was Christology,
                  specifically how to express the unity of Christ’s divinity and humanity. The Oriental Orthodox 
                  did not accept Chalcedon’s “in two natures” wording, and instead confess the formula of 
                  St Cyril of Alexandria: “One Incarnate Nature of God the Logos” (Miaphysis), 
                  while rejecting both Nestorian division and Eutychian “monophysitism.” 
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Welcome CTA */}
      <section className="section-padding bg-primary-900">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="font-serif text-heading-1 mb-6">
              You Are Welcome Here
            </h2>
            <p className="text-lg text-white/80 mb-8">
              We warmly invite you to visit, ask questions, and experience the
              beauty of the ancient Christian faith. You don't need to understand
              everything — just come as you are.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button href="/im-new" variant="gold" size="lg">
                Plan Your Visit
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
