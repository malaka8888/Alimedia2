import { Elephant } from '../types/elephant';

export const INITIAL_VERIFIED_ELEPHANTS: Elephant[] = [
  {
    id: "indiraja",
    name: "Indiraja",
    sinhalaName: "ඉන්දිරාජා",
    otherNames: ["Indi Raja", "Maligawa Indiraja"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "", // Unverified exact birth date
    age: 44, // Estimated c. 1980
    location: "Kandy (මහනුවර)",
    organization: "Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)",
    mahout: "Dedicated Maligawa Custodians",
    tusks: "Majestic long symmetrical twin ivory tusks (දිගු සවිමත් යුගල දළ)",
    physicalCharacteristics: "Stately height of approx. 9.8 feet, dignified bearing, prominent temporal bumps (කුම්භස්ථල), disciplined gait suited for bearing the sacred casket.",
    description: "Gifted by the Prime Minister of India Rajiv Gandhi to Sri Dalada Maligawa in 1987. Indiraja is one of the most revered ceremonial tuskers in Sri Lanka, frequently carrying the sacred relics casket (ධාතු කරඬුව) during the historic Kandy Esala Perahera.",
    peraheraParticipation: [
      "Kandy Esala Perahera (මහනුවර ඇසළ පෙරහැර)",
      "Navam Maha Perahera (නවම් මහා පෙරහැර)",
      "Aluth Sahal Mangallaya (අලුත් සහල් මංගල්‍යය)"
    ],
    photos: [
      "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1603855073959-f23247076a03?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Sri Dalada Maligawa Official Custodians Registry",
        url: "https://sridaladamaligawa.com",
        publisher: "Diyawadana Nilame Secretariat",
        verifiedDate: "2024"
      },
      {
        title: "Department of Wildlife Conservation - Captive Elephant Registry",
        publisher: "Ministry of Wildlife & Forest Resources Conservation",
        verifiedDate: "2023"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "myan-kumara",
    name: "Myan Kumara",
    sinhalaName: "මියන් කුමාර",
    otherNames: ["Myanmar Kumara", "Burma Raja"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "",
    age: 32,
    location: "Kandy (මහනුවර)",
    organization: "Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)",
    mahout: "", // Display "තොරතුරු නොමැත"
    tusks: "Curved upward tusks with ivory sheen (ඉහළට වක්‍ර වූ අලංකාර දළ යුගල)",
    physicalCharacteristics: "Robust body structure, deep grey skin with distinct ear pigmentation, calm temperament during high-noise cultural festivities.",
    description: "Gifted to the sacred Temple of the Tooth Relic by the Government of Myanmar in 2007 as a goodwill gesture between Buddhist nations. Myan Kumara participates as a prominent tusker in major cultural pageants.",
    peraheraParticipation: [
      "Kandy Esala Perahera (ඇසළ මංගල්‍යය)",
      "Bellanwila Esala Perahera",
      "Gangarama Navam Perahera"
    ],
    photos: [
      "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Sri Dalada Maligawa Diplomatic Gifts Archives",
        url: "https://sridaladamaligawa.com",
        publisher: "Sri Dalada Maligawa",
        verifiedDate: "2022"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "vasana",
    name: "Vasana",
    sinhalaName: "වාසනා",
    otherNames: ["Kataragama Vasana", "Ruhunu Vasana"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "",
    age: 55,
    location: "Kataragama (කතරගම)",
    organization: "Ruhunu Maha Kataragama Devalaya (රුහුණු මහා කතරගම දේවාලය)",
    mahout: "Somapala Mahout Family",
    tusks: "Prominent parallel tusks with rounded tips (සමාන්තර දිගු දළ යුගල)",
    physicalCharacteristics: "Commanding height of nearly 10 feet, broad forehead, quiet and obedient disposition even in massive festival crowds.",
    description: "Vasana is the chief tusker of the Ruhunu Maha Kataragama Devalaya. For decades, Vasana has had the solemn honor of carrying the sacred relic casket of Lord Kataragama during the annual historic Esala festival in Southern Sri Lanka.",
    peraheraParticipation: [
      "Ruhunu Maha Kataragama Esala Perahera",
      "Devinuwara Esala Perahera",
      "Kandy Esala Perahera"
    ],
    photos: [
      "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Ruhunu Maha Kataragama Devalaya Historical Records",
        publisher: "Basnayake Nilame Office",
        verifiedDate: "2024"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "kandula",
    name: "Kandula",
    sinhalaName: "කණ්ඩුල",
    otherNames: ["Kelaniya Kandula", "Kelani Raja"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "1996-03-12",
    age: 29,
    location: "Kelaniya, Colombo (කැලණිය)",
    organization: "Kelaniya Raja Maha Viharaya (කැලණිය රජ මහා විහාරය)",
    mahout: "Gamini Wijeratne",
    tusks: "Well-aligned bright ivory tusks (දීප්තිමත් සමබර දළ)",
    physicalCharacteristics: "Graceful proportion, high head carriage, docile and accustomed to temple religious rituals and processions.",
    description: "Kandula resides at the historic Kelaniya Raja Maha Vihara, one of the most sacred pilgrimage sites in Sri Lanka. Named after the legendary royal elephant of King Dutugemunu, Kandula is a central figure in the annual Kelaniya Duruthu Maha Perahera.",
    peraheraParticipation: [
      "Kelaniya Duruthu Maha Perahera (කැලණිය දුරුතු මහා පෙරහැර)",
      "Kotte Sri Rajamaha Vihara Perahera",
      "Seenigama Devalaya Perahera"
    ],
    photos: [
      "https://images.unsplash.com/photo-1603855073959-f23247076a03?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Kelaniya Raja Maha Vihara Temple Chronicles",
        publisher: "Dayaka Sabha Documentation",
        verifiedDate: "2023"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "sama",
    name: "Sama",
    sinhalaName: "සාමා",
    otherNames: ["Pinnawala Sama"],
    gender: "female",
    type: "elephant",
    dateOfBirth: "",
    age: 38,
    location: "Pinnawala, Kegalle (පින්නවල)",
    organization: "Pinnawala Elephant Orphanage (පින්නවල අලි අනාථාගාරය)",
    mahout: "",
    tusks: "Tuskless female elephant (දළ රහිත ඇතින්න)",
    physicalCharacteristics: "Amputated right front leg consequence of an anti-personnel landmine in 1988 during the northern conflict; fitted with a custom prosthetic limb.",
    description: "Sama arrived at Pinnawala Elephant Orphanage as a wounded calf in 1988 after losing a foot to a landmine. She has become an international symbol of resilience and the dedicated veterinary care provided by Sri Lankan wildlife officers.",
    peraheraParticipation: [],
    photos: [
      "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "National Zoological Gardens of Sri Lanka - Pinnawala Archive",
        url: "http://nationalzoo.gov.lk",
        publisher: "Department of National Zoological Gardens",
        verifiedDate: "2023"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "abhaya",
    name: "Abhaya",
    sinhalaName: "අභය",
    otherNames: ["Bellanwila Abhaya"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "",
    age: 26,
    location: "Bellanwila, Boralesgamuwa (බෙල්ලන්විල)",
    organization: "Bellanwila Raja Maha Viharaya (බෙල්ලන්විල රජ මහා විහාරය)",
    mahout: "Kumara Mahout",
    tusks: "Developing thick ivory pair with forward arc",
    physicalCharacteristics: "Energetic and healthy young tusker, distinctive broad trunk base, friendly temperament under professional supervision.",
    description: "Custodially cared for at the venerated Bellanwila Raja Maha Viharaya. Abhaya represents the younger generation of domesticated tuskers undergoing traditional ceremonial training for Buddhist processions.",
    peraheraParticipation: [
      "Bellanwila Esala Perahera (බෙල්ලන්විල පෙරහැර)",
      "Gangaramaya Navam Perahera"
    ],
    photos: [
      "https://images.unsplash.com/photo-1544979590-37e9b47eb705?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Bellanwila Raja Maha Viharaya Community Documentation",
        publisher: "Temple Trust",
        verifiedDate: "2024"
      }
    ],
    verified: true,
    status: "living"
  },
  {
    id: "nadungamuwa-raja",
    name: "Nadungamuwa Raja",
    sinhalaName: "නැදුන්ගමුවේ රාජා",
    otherNames: ["Nadungamuwa Vijaya Raja", "The Gentle Giant of Asia"],
    gender: "male",
    type: "tusker",
    dateOfBirth: "1953-00-00",
    age: 69, // Lived 1953 - 2022
    location: "Gampaha / Nadungamuwa (ගම්පහ)",
    organization: "Nadungamuwa Ayurvedic Sanstha / National Treasure",
    mahout: "Kalanis Wilson (Harmanis)",
    tusks: "Majestic 7-foot symmetrical downward-sweeping ivory tusks touching the earth (භූමිස්පර්ශ දළ යුගල)",
    physicalCharacteristics: "10.5 feet (3.2 m) in height, Asia's tallest captive tusker of his era, legendary seven-point ground posture (හත්පොළ ස්පර්ශය).",
    description: "The most iconic sacred casket bearer of modern Sri Lankan history. Declared a National Treasure of Sri Lanka in 2022. For over 15 consecutive years, Nadungamuwa Raja walked over 90 km from Gampaha to Kandy to carry the sacred relic casket at the Esala Perahera.",
    peraheraParticipation: [
      "Kandy Esala Perahera Chief Casket Bearer (2006-2021)",
      "Bellanwila Esala Perahera",
      "Kotte Raja Maha Viharaya Perahera"
    ],
    photos: [
      "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Government of Sri Lanka Presidential Gazette Extraordinary - National Treasure Declaration",
        publisher: "Department of Government Printing",
        verifiedDate: "2022"
      },
      {
        title: "Sri Dalada Maligawa Perahera Roll of Honor",
        url: "https://sridaladamaligawa.com",
        publisher: "Temple of the Sacred Tooth Relic",
        verifiedDate: "2022"
      }
    ],
    verified: true,
    status: "memorial"
  },
  {
    id: "singithi",
    name: "Singithi",
    sinhalaName: "සිඟිති",
    otherNames: ["Singithi Elephant"],
    gender: "female",
    type: "elephant",
    dateOfBirth: "",
    age: 33,
    location: "Kandy (මහනුවර)",
    organization: "Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)",
    mahout: "",
    tusks: "Tuskless female (දළ රහිත ඇතින්න)",
    physicalCharacteristics: "Calm demeanor, medium stature, gentle stride, well-trained in ceremonial protocols.",
    description: "A cherished female domesticated elephant participating in traditional temple processions and daily religious activities in the central hill capital.",
    peraheraParticipation: [
      "Kandy Esala Perahera",
      "Aluth Sahal Mangallaya"
    ],
    photos: [
      "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80"
    ],
    sources: [
      {
        title: "Temple of the Tooth Relic Domesticated Elephant Archive",
        publisher: "Maligawa Documentation Center",
        verifiedDate: "2023"
      }
    ],
    verified: true,
    status: "living"
  }
];
