import type { Metadata } from 'next'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'St. Kyrillos VI - Our Patron Saint',
  description: 'Learn about Pope Kyrillos VI (1902-1971), the 116th Pope of Alexandria and patron saint of our church. A man of deep prayer, humility, and miracles.',
}

export default function StKyrillosPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-gold font-semibold mb-4 tracking-widest text-sm uppercase">Our Patron Saint</p>
            <div className="relative flex items-center justify-center gap-8 mb-4">
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
              <h1 className="font-serif text-display-2 md:text-display-1">
                Pope Kyrillos VI
              </h1>
              <Image
                src="/images/CC5.png"
                alt=""
                width={100}
                height={100}
                className="hidden md:block w-24 h-24 opacity-40"
              />
            </div>
            <p className="text-xl text-white/80">
              1902 – 1971 &nbsp;•&nbsp; 116th Pope of Alexandria
            </p>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              Orthodox churches are named after saints, people who lived righteous, God-fearing lives
              and were recognized by the Church for their holiness. Their stories become encouragement
              for every generation that follows them.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Our patron saint is <strong className="text-gray-900">Saint Pope Kyrillos VI</strong>,
              the 116th Pope of Alexandria, remembered on March 9th as a man of extraordinary prayer,
              deep humility, and countless miracles. He brought the Coptic Church into a new era of
              spirituality and was beloved by Christians and non-Christians alike across Egypt.
            </p>
          </div>
        </div>
      </section>

      {/* Early Life */}
      <section className="py-16 bg-stone-50">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-start">
            <div className="space-y-5">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-gold/30" />
                <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium">Early Life</p>
                <div className="h-px flex-1 bg-gold/30" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-gray-900 mb-6">A Heart Set Apart</h2>
              <p className="text-gray-700 leading-relaxed">
                Pope Kyrillos VI was born on <strong>August 2, 1902</strong> and was given the name <strong>Azer Ata</strong>.
                His father was a church deacon, and Azer grew up in a middle-class family in Egypt. After completing high school
                he worked for a shipping company in Alexandria, but his heart was elsewhere. He was content with little food
                and the ground to sleep on.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Much against his family&apos;s wishes, he resigned and entered the <strong>Monastery of El-Baramous</strong> on
                July 27, 1927. He was ordained a monk on February 25, 1928 and given the name <strong>Mina</strong>, after
                his patron saint, St. Mina of Mariout. He was ordained priest on July 18, 1931.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Father Mina&apos;s love for God was so consuming that he desired a life of complete solitude. He was only thirty
                years old when he asked. The elder monks refused him: <em>&ldquo;You are only thirty years old and your monastic life
                is only five years. Do you want to pursue the life of solitude in the desert whereas many others before you have
                struggled for the same goal for thirty or forty years and failed?&rdquo;</em> Father Mina was undeterred.
              </p>
            </div>

            <div className="relative">
              <div className="relative h-[480px] rounded-sm overflow-hidden shadow-xl">
                <Image
                  src="/images/side-popek.jpg"
                  alt="Pope Kyrillos VI"
                  fill
                  className="object-cover object-top"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 border-2 border-gold/30 rounded-sm pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* The Windmill */}
      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-gold/30" />
              <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium">The Desert & The Windmill</p>
              <div className="h-px flex-1 bg-gold/30" />
            </div>

            <h2 className="font-serif text-3xl md:text-4xl text-gray-900 mb-8">A Life of Solitude</h2>

            <div className="space-y-5 text-gray-700 leading-relaxed">
              <p>
                Father Mina lived first in a cave near the monastery, then headed to the <strong>Monastery of Saint Anba Samuel
                the Confessor</strong> at Zawarah in Upper Egypt, where he devoted great effort to restoring that historic landmark.
                When the monastery was restored, he moved on to a <strong>deserted windmill on El-Moukatam mountain</strong>
                at the outskirts of Cairo.
              </p>
              <p>
                This windmill was totally abandoned and dangerous, miles from the nearest city, surrounded by scorpions and snakes.
                Here, Father Mina spent his time in prayer and contemplation because of his love for his Saviour. Satan laid many
                obstacles before him. A guard was instigated not to carry water to the monk. God then sent one of His saints in
                a dream to rebuke the guard, who rushed to bring water to Father Mina who was in urgent need.
              </p>
              <p>
                In another incident, robbers came to the windmill and beat Father Mina, injuring his head. When he regained
                consciousness and found himself bleeding, he crawled to the icon of Saint Mina and placed it on his wound.
                The bleeding stopped immediately. He then walked fifteen miles to reach a hospital. The doctors were speechless.
              </p>
            </div>

            {/* Pull quote */}
            <blockquote className="my-12 border-l-4 border-gold pl-6">
              <p className="font-serif text-xl text-gray-800 italic leading-relaxed">
                &ldquo;Let us disappear for God to appear with His blessed glory.&rdquo;
              </p>
              <cite className="text-sm text-gray-500 mt-3 block">Pope Kyrillos VI, from his first papal letter</cite>
            </blockquote>

            <div className="space-y-5 text-gray-700 leading-relaxed">
              <p>
                Father Mina eventually built a <strong>church in Ancient Cairo</strong> under the name of Saint Mina and lived
                there until his ordination as Pope. He found himself surrounded by college students, many from outside Cairo,
                so he started a dormitory, the first church-affiliated student dormitory in modern Egypt. Many of those students
                went on to become bishops and priests, including <strong>Pope Shenouda III</strong>, his successor.
              </p>
              <p>
                Father Mina used to clean the dormitory and lavatories himself, without letting anyone know, and would not allow
                anyone else to do it. By humiliating himself and serving others, he fulfilled the Lord&apos;s commandment:
                <em> &ldquo;Whosoever will be chief among you, let him be your servant.&rdquo; (Matthew 20:27)</em>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pope & Prayer Life */}
      <section className="py-16 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }} />
        <div className="container-custom relative z-10">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">

            {/* Pope section */}
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-4">1959 – 1971</p>
              <h2 className="font-serif text-3xl text-white mb-6">The 116th Pope of Alexandria</h2>
              <div className="space-y-4 text-gray-300 leading-relaxed text-sm">
                <p>
                  Father Mina was ordained Pope on <strong className="text-white">Sunday, May 10, 1959</strong> and took the name
                  Kyrillos VI. Before him, five Popes had borne that name. The first was Saint Cyril the Great, the pillar of faith
                  who defended the unity of Christ&apos;s person against Nestorianism at the Council of Ephesus (431 AD).
                </p>
                <p>
                  On his enthronement day, at the end of the liturgy, the new Pope stood for hours blessing each person individually.
                  Bishops begged him to rest when they saw his exhaustion and sweat. He refused to send anyone away. From then on,
                  he continued this practice throughout his papacy.
                </p>
                <p>
                  He abolished any barrier between himself and his people. The room in his private quarters was famously humble.
                  When a foreign priest offered to furnish it with luxury, the Pope laughed: <em>&ldquo;The room in its current
                  state is still much better than the manger where Christ was born.&rdquo;</em>
                </p>
              </div>
            </div>

            {/* Prayer life */}
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-4">The Life of Prayer</p>
              <h2 className="font-serif text-3xl text-white mb-6">12,000 Masses</h2>
              <div className="space-y-4 text-gray-300 leading-relaxed text-sm">
                <p>
                  It is said that Pope Kyrillos prayed more than <strong className="text-white">12,000 Divine Liturgies</strong> during
                  his lifetime. He would begin at <strong className="text-white">3:00 or 4:00 in the morning</strong> with the Holy
                  Psalmody and finish liturgy early so that his children could get to school and work. This continued for thirty-five
                  years since his days as a hermit.
                </p>
                <p>
                  Those who spent time with him described it: six continuous hours of prayer. Midnight Agpeya, baking the korban,
                  raising incense, then the Divine Liturgy. Afterwards he would meet with all who came: the sick, the uncertain,
                  the tormented. <em>&ldquo;Whoever sat with Father Mina obtained a heavenly relief. One would leave knowing that
                  his ship had found a true haven.&rdquo;</em>
                </p>
                <p>
                  In his last days, gravely ill, he had a speaker connected from the Cathedral to his bedroom so he would not miss
                  the liturgy he could no longer stand to serve.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-16 bg-stone-50">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-3">Legacy</p>
              <h2 className="font-serif text-3xl md:text-4xl text-gray-900">What He Built</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {[
                {
                  n: '01',
                  title: 'The Return of St. Mark\'s Relics',
                  text: 'For centuries the Coptic Church longed for the return of the body of St. Mark, martyred in Alexandria in 68 AD, from Italy. Under Pope Kyrillos VI, this dream was realized. As the plane landed, luminous beings in the shape of white pigeons flew over Cairo Airport and were seen by all present, half an hour before midnight, when real pigeons do not fly.',
                },
                {
                  n: '02',
                  title: 'Apparitions at Zeitoun',
                  text: 'During his papacy, the Blessed Virgin Mary appeared at the Church of Zeitoun in Cairo — witnessed by millions including non-Christians — in a series of miraculous apparitions documented worldwide.',
                },
                {
                  n: '03',
                  title: 'Coptic Churches Worldwide',
                  text: 'For the first time in Coptic history, Pope Kyrillos established churches in Asia, America, Canada, and Australia, and sent priests to Europe and Africa, planting the ancient faith across the modern world.',
                },
                {
                  n: '04',
                  title: 'The Monastery of Saint Mina',
                  text: 'He founded and expanded the Monastery of Saint Mina at Mariout, honoring his patron saint and creating a place of pilgrimage and prayer that continues to this day. His holy body rests there per his final wishes.',
                },
              ].map((item) => (
                <div key={item.n} className="flex gap-5 p-8 border-b border-gray-200 md:[&:nth-child(odd)]:border-r">
                  <span className="font-serif text-2xl text-gold/40 leading-none mt-1 select-none">{item.n}</span>
                  <div>
                    <h3 className="font-serif text-lg text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Miracles */}
      <section className="py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-gold font-medium mb-4">Miracles</p>
            <h2 className="font-serif text-3xl md:text-4xl text-gray-900 mb-8">A Witness to God&apos;s Power</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              It is said that nearly every person who lived during the days of Pope Kyrillos witnessed a personal miracle:
              healings from illness, the casting out of demons, miraculous resolution of difficult circumstances, and the
              revelation of hidden things that led people to faith and repentance. Saint Pope Kyrillos&apos; miracles continue
              to be documented to this day.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              More than <strong>18 printed volumes</strong> document the miracles of Pope Kyrillos VI, originally published
              in Arabic by the Pope Kyrillos VI Society and translated into English, French, and other languages.
            </p>
          </div>
        </div>
      </section>

      {/* Feast Day */}
      <section className="py-16 bg-gray-50">
        <div className="container-custom">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-3xl text-gray-900 mb-4">Feast Day</h2>
            <p className="text-gray-600 text-lg mb-8">
              The feast of Pope Kyrillos VI is celebrated on{' '}
              <strong>Amshir 30</strong> (Coptic calendar) /{' '}
              <strong>March 9th</strong> (Gregorian), the day of his departure.
            </p>
            <Button href="/schedule" variant="primary">
              See Our Schedule
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
