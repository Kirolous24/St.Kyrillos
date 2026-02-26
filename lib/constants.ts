// ============================================
// CHURCH INFORMATION
// Update these values with actual church data
// ============================================

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
  email: "[EMAIL ADDRESS]",

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
      email: "[FR. PACHOM EMAIL]",
      phone: "[FR. PACHOM PHONE]",
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
  // Google Calendar embed URL (UPDATE THIS)
  calendarEmbedUrl: "https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=America%2FChicago&showPrint=0&showTitle=0&src=YjhlMmIxMjhlYWM0NGJiMDNhNDBkZDdhZDY1OTYzMjAxMGM3YWFmNGNiYjY2NzU4ZGU1NjJjZDY4ZWIyZWQ0MUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=aHA4YXFlbDhzdGo3bGdnYXNkODF0NnQybzhAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ&color=%23ad1457&color=%233f51b5",
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
      { label: "Clergy", href: "/about/clergy" },
      { label: "St. Kyrillos VI", href: "/about/st-kyrillos-vi" },
    ],
  },
  {
    label: "I'm New",
    href: "/im-new",
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
] as const;

export const FOOTER_LINKS = {
  quickLinks: [
    { label: "Schedule", href: "/schedule" },
    { label: "Services", href: "/services" },
    { label: "I'm New", href: "/im-new" },
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
        answer: "Absolutely! We welcome visitors of all backgrounds — whether you're exploring Orthodoxy, coming from another Christian tradition, or simply curious. You are not required to be Orthodox to attend our services. Come as you are.",
      },
      {
        question: "What should I wear?",
        answer: "We ask that visitors dress modestly out of respect for the sacred space. For women, this typically means skirts or dresses below the knee and shoulders covered (no tank tops). For men, long pants and a collared shirt are appropriate, though not required. Head coverings for women are welcome but not mandatory for visitors. If you're unsure, err on the side of modest and comfortable.",
      },
      {
        question: "How long is the Divine Liturgy?",
        answer: "The Sunday Divine Liturgy typically lasts 2.5 to 3 hours. We know that's longer than many church services! Feel free to arrive a bit late or step out if needed — no one will judge you. Many families with young children come and go as needed. Weekday services and vespers are shorter, usually 1 to 1.5 hours.",
      },
      {
        question: "What should I do during the Liturgy?",
        answer: "Don't worry about getting everything right! Stand when others stand, sit when others sit. You are welcome to follow along with the hymns and responses (we have service books available), or simply observe and pray silently. The congregation stands for most of the Liturgy — chairs are available along the walls for those who need them.",
      },
      {
        question: "Where should I sit (or stand)?",
        answer: "In our church, men typically stand on the right side and women on the left. This is a traditional arrangement, not a strict rule — visitors may sit or stand wherever they're comfortable.",
      },
    ],
  },
  {
    category: "Holy Communion & Participation",
    questions: [
      {
        question: "Can I receive Holy Communion?",
        answer: "Holy Communion is reserved for Orthodox Christians who have prepared through fasting, prayer, and recent confession. If you are not Orthodox, we kindly ask that you refrain from receiving Communion during the Liturgy. However, you are welcome to approach the priest at the end of the service to receive blessed bread (not the Eucharist), which is offered to all.",
      },
      {
        question: "What if I'm Orthodox but from a different tradition (Greek, Russian, etc.)?",
        answer: "If you are a baptized and chrismated Orthodox Christian from a canonical Orthodox church (Eastern or Oriental), you are welcome to receive Communion after confirming with our priest. Please speak with Fr. Pachom before the service.",
      },
    ],
  },
  {
    category: "Families & Children",
    questions: [
      {
        question: "Are children welcome?",
        answer: "Yes! Children are an important part of our community. They are welcome in the Liturgy at all times. Young children may make noise — this is normal and expected. We have a cry room available if you need a quieter space.",
      },
      {
        question: "Is there Sunday School?",
        answer: "Yes, we have Sunday School for children during or after the Divine Liturgy (depending on the week). Classes are organized by age group. Please ask a greeter for details or check our Schedule page.",
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
