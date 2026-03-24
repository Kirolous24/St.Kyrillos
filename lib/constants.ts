// ============================================
// CHURCH INFORMATION
// Update these values with actual church data
// ============================================

export const SITE_URL = 'https://stkyrillostn.org'

export const CHURCH_INFO = {
  name: "St. Kyrillos the Sixth",
  fullName: "St. Kyrillos the Sixth Coptic Orthodox Church",
  tagline: "An ancient faith. A welcoming home.",
  location: "Antioch, Tennessee",

  // Contact Information (UPDATE THESE)
  address: {
    street: "Address: 5988 Cane Ridge Rd",
    city: "Antioch",
    state: "TN",
    zip: "37013",
    full: "5988 Cane Ridge Rd Antioch, TN 37013",
  },
  phone: "(954) 663-0569",
  email: "fr.pachom@stkyrillostn.org",

  // Office Hours (UPDATE THESE)
  officeHours: [
    { day: "Sunday", hours: "After Divine Liturgy" },
    { day: "Tuesday - Friday", hours: "By Appointment" },
  ],

  // Diocese
  diocese: {
    name: "Coptic Orthodox Diocese of the Southern United States",
    url: "https://www.suscopts.org",
  },
} as const;

// ============================================
// CLERGY INFORMATION
// ============================================

export const CLERGY = [
  {
    id: "fr-pachom",
    name: "Fr. Pachom Ibrahim",
    title: "Parish Priest",
    image: "/images/clergy/headshot.png", // Placeholder
    bio: `Fr. Pachom Ibrahim is the priest for St. Kyrillos the Sixth Coptic Orthodox Church located in Nashville, TN. H.H. Pope Tawadros, with the presence of his Eminence Metropolitan Youssef and other bishops, ordained him priest on October 10, 2015. He began his service in St. Mark Coptic Orthodox Church in Nashville, Tennessee. Then in 2016, his Eminence Metropolitan Youssef asked him to serve in St. Kyrillos the Sixth Coptic Orthodox Church. Fr. Pachom has been serving within the Diocese of the Southern United States since October 10, 2015. We pray that the Lord will continue blessing his service.`,
    contact: {
      email: "fr.pachom@stkyrillostn.org",
      phone: "954-663-0569",
    },
  },
] as const;

// ============================================
// SERVICE SCHEDULE
// Update with actual service times
// ============================================

export const SCHEDULE = {
  regular: [
    {
      day: "Sunday",
      services: [
        { name: "Matins (Morning Raising of Incense)", time: "[TIME]" },
        { name: "Divine Liturgy", time: "8:00 AM" },
        { name: "Sunday School", time: "[TIME]" },
      ],
    },
    {
      day: "Wednesday",
      services: [
        { name: "Bible Study", time: "[TIME]" },
      ],
    },
    {
      day: "Friday",
      services: [
        { name: "Youth Meeting", time: "[TIME]" },
      ],
    },
  ],
  calendarNote: "Schedule may change during fasting seasons and feast days.",
} as const;

// ============================================
// SOCIAL MEDIA LINKS
// Update with actual URLs
// ============================================

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/stkyrilloscoc/",
  youtube: "https://www.youtube.com/@SaintKyrillosTN",
} as const;

// ============================================
// GIVING INFORMATION
// ============================================

export const GIVING = {
  // Update with actual giving platform URL
  onlineUrl: "[GIVING_PLATFORM_URL]", // Tithe.ly, Givelify, or PayPal
  checkPayableTo: "St. Kyrillos the Sixth Coptic Orthodox Church",
  mailingAddress: CHURCH_INFO.address.full,
  scripture: {
    text: "Bring all the tithes into the storehouse, that there may be food in My house, and try Me now in this, says the Lord of hosts, if I will not open for you the windows of heaven and pour out for you such blessing that there will not be room enough to receive it.",
    reference: "Malachi 3:10",
  },
} as const;

// ============================================
// LIVESTREAM
// ============================================

export const LIVESTREAM = {
  youtubeChannelHandle: "@SaintKyrillosTN",
  youtubeChannelUrl: "https://www.youtube.com/@SaintKyrillosTN",
  youtubeStreamsUrl: "https://www.youtube.com/@SaintKyrillosTN/streams",
  youtubeLiveUrl: "https://www.youtube.com/@SaintKyrillosTN/live", // Auto-redirects to current live stream
  youtubeChannelId: "UC99uTRwGS6gunBt6jPXlozA",
  youtubeLiveEmbedUrl: "https://www.youtube.com/embed/live_stream?channel=UC99uTRwGS6gunBt6jPXlozA",
  facebookPageUrl: "https://www.facebook.com/stkyrilloscoc/",
  schedule: "Divine Liturgy is livestreamed every Sunday",
} as const;

// ============================================
// NAVIGATION STRUCTURE
// ============================================

export const NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "What is Coptic Orthodoxy?", href: "/about/coptic-orthodoxy" },
      { label: "FAQs", href: "/about/faqs" },
      { label: "Clergy", href: "/about/clergy" },
      { label: "St. Kyrillos VI", href: "/about/st-kyrillos-vi" },
    ],
  },
  {
    label: "Services",
    href: "/services",
  },
  {
    label: "Schedule",
    href: "/schedule",
  },
  {
    label: "Confessions",
    href: "/confession",
  },
  {
    label: "Resources",
    href: "/resources",
  },
  {
    label: "Join",
    href: "/members/join",
  },
] as const;

export const FOOTER_LINKS = {
  quickLinks: [
    { label: "Schedule", href: "/schedule" },
    { label: "Services", href: "/services" },
    { label: "FAQs", href: "/about/faqs" },
    { label: "Give", href: "/give" },
    { label: "Resources", href: "/resources" },
  ],
  memberLinks: [
    { label: "Join Our Church", href: "/members/join" },
    { label: "Volunteer", href: "/members/volunteer" },
    { label: "Prayer Request", href: "/members/prayer-request" },
  ],
} as const;

// ============================================
// FAQ DATA
// ============================================

// ============================================
// CONFESSION / APPOINTMENTS CONFIG
// ============================================

export const CONFESSION_CONFIG = {
  clergName: "Fr. Pachom Ibrahim",
  clergTitle: "Parish Priest",
  clergImage: "/images/headshot.png",

  appointmentDuration: 20, // minutes

  // Available days of week (0=Sunday, 1=Monday, etc.)
  availableDays: [0, 1, 2, 3, 4, 5, 6], // All days available

  // Available time slots (24-hour format)
  timeSlots: [
    "10:00", "10:30", "11:00", "11:30",
    "14:00", "14:30", "15:00", "15:30", "16:00"
  ],

  timezone: "America/Chicago",

  location: {
    name: "St. Kyrillos the Sixth Coptic Orthodox Church",
    street: "5988 Cane Ridge Rd",
    cityStateZip: "Antioch, TN 37013"
  }
} as const;

export const FAQS = [
  {
    category: "Visiting Our Church",
    questions: [
      {
        question: "Can I visit if I'm not Orthodox?",
        answer: "Yes, absolutely. Our community includes both cradle Orthodox Christians and those who have converted to the faith, so we are very comfortable with newcomers, inquirers, and visitors. Anyone who wishes to discover ancient Coptic Orthodox Christianity is welcome. If you have questions, our priest will be happy to answer them, so please feel free to ask what we do and why.",
      },
      {
        question: "What should I wear?",
        answer: "The general rule for both men and women is to dress appropriately, modestly, and respectfully, as we stand before the living God. Business-casual attire is typically suitable.",
      },
      {
        question: "How long is the service?",
        answer: "There are several services. On Saturday evenings, the Raising of Incense service (Vespers) is generally 30 to 45 minutes, followed by Midnight Praises, which last around 60 minutes. On Sunday mornings, a similar service is celebrated before the Divine Liturgy. The Divine Liturgy is approximately 2 hours, with an sermon of about 15 minutes in between. Distribution of the Mystery of the Eucharist takes place toward the end.",
      },
      {
        question: "What should I do during the Liturgy?",
        answer: "In the Coptic Orthodox Church, we invite everyone to participate by singing along, standing, sitting, and making the sign of the cross as an outward expression of inner faith. Some hymns may be new to you, but feel free to join in. That is often the best way to learn. Don’t worry if you are unsure when to sit or stand; you are free to do as much or as little as you are comfortable with.",
      },
      {
        question: "Where should I sit (or stand)?",
        answer: "Traditionally, in our church, men stand on the right side (facing the altar) and women on the left.",
      },
    ],
  },
  {
    category: "Holy Communion & Participation",
    questions: [
      {
        question: "Can I receive Holy Communion?",
        answer: "Orthodox priests may serve the Holy Eucharist only to baptized members in good standing of the canonical Orthodox Church who have recently confessed and fasted before partaking of the Holy Eucharist. This has been the ancient tradition of the Holy Church throughout her 2,000-year history. The Orthodox Church understands the Holy Eucharist as the true mystery of Christ's real presence, not simply a memorial or only a spiritual symbol. Rather than adapting this teaching to varying interpretations, we ask visitors to respect the ancient apostolic tradition and join us in receiving the Eulogia (blessed bread) at the end of the Divine Liturgy.",
      },
    ],
  },
  {
    category: "Families & Children",
    questions: [
      {
        question: "Are children welcome?",
        answer: "Yes. Children are an important part of our community and are always welcome in the Divine Liturgy. Some noise from young children is normal and expected. If a child becomes very noisy, we kindly ask families to use the cry room until they settle. We also offer many services for children, including Sunday School, hymns classes, Bible studies, and more.",
      },
      {
        question: "Is there Sunday School?",
        answer: "Yes, we have Sunday School for children during or after the Divine Liturgy (depending on the week). Classes are organized by age group. Please ask one of our servants for details or check our Schedule page.",
      },
    ],
  },
  {
    category: "Getting Involved",
    questions: [
      {
        question: "How do I become Orthodox / join the church?",
        answer: "If you're interested in becoming Orthodox, we welcome you to attend services regularly and speak with our priest about beginning the catechumenate — a period of learning and preparation that leads to Baptism and/or Chrismation. This journey typically takes several months to a year.",
      },
      {
        question: "How do I arrange a baptism, wedding, or other sacrament?",
        answer: "Please contact Fr. Pachom directly to discuss baptisms, weddings, confessions, or other sacramental needs. You can reach him through our Contact page or by calling the church office.",
      },
    ],
  },
] as const;
