// Site structure: which pages exist, their type, menu group and links between them.
// "visa": "travel" or "evisa" adds the price tables (travel visas also get the delivery table).
// Page TEXT lives in src/content (edited in the admin at /admin). Changing this file is a code change.
export const structure = [
  {
    "slug": "uk-visa-services",
    "type": "hub",
    "group": "uk",
    "children": [
      "uk-spouse-visas",
      "work-visa-uk",
      "student-visa-uk",
      "uk-visit-visa",
      "indefinite-leave-to-remain-ilr",
      "british-citizenship",
      "sponsor-licence-application"
    ]
  },
  {
    "slug": "uk-spouse-visas",
    "type": "hub",
    "group": "uk",
    "children": [
      "uk-spouse-visa-application",
      "uk-spouse-visa-extension",
      "civil-partner-visa",
      "fiance-visa-application",
      "unmarried-partner-visa"
    ]
  },
  {
    "slug": "uk-spouse-visa-application",
    "type": "service",
    "group": "uk",
    "related": [
      "uk-spouse-visa-extension",
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "uk-spouse-visa-extension",
    "type": "service",
    "group": "uk",
    "related": [
      "uk-spouse-visa-application",
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "civil-partner-visa",
    "type": "service",
    "group": "uk",
    "related": [
      "uk-spouse-visa-application",
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "fiance-visa-application",
    "type": "service",
    "group": "uk",
    "related": [
      "uk-spouse-visa-application"
    ]
  },
  {
    "slug": "unmarried-partner-visa",
    "type": "service",
    "group": "uk",
    "related": [
      "uk-spouse-visa-application"
    ]
  },
  {
    "slug": "work-visa-uk",
    "type": "hub",
    "group": "uk",
    "children": [
      "skilled-worker-visa-formally-tier-t2-general",
      "post-study-work-visa",
      "sponsor-licence-application"
    ]
  },
  {
    "slug": "skilled-worker-visa-formally-tier-t2-general",
    "type": "service",
    "group": "uk",
    "related": [
      "sponsor-licence-application",
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "student-visa-uk",
    "type": "service",
    "group": "uk",
    "related": [
      "post-study-work-visa"
    ]
  },
  {
    "slug": "post-study-work-visa",
    "type": "service",
    "group": "uk",
    "related": [
      "skilled-worker-visa-formally-tier-t2-general",
      "student-visa-uk"
    ]
  },
  {
    "slug": "indefinite-leave-to-remain-ilr",
    "type": "service",
    "group": "uk",
    "related": [
      "british-citizenship"
    ]
  },
  {
    "slug": "british-citizenship",
    "type": "service",
    "group": "uk",
    "related": [
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "uk-visit-visa",
    "type": "service",
    "group": "uk"
  },
  {
    "slug": "hire-foreign-nationals-uk",
    "type": "hub",
    "group": "employer",
    "children": [
      "sponsor-licence-application",
      "skilled-worker-visa-formally-tier-t2-general"
    ]
  },
  {
    "slug": "sponsor-licence-application",
    "type": "service",
    "group": "employer",
    "related": [
      "skilled-worker-visa-formally-tier-t2-general"
    ]
  },
  {
    "slug": "corporate-clients",
    "type": "service",
    "group": "employer"
  },
  {
    "slug": "worldwide-visas",
    "type": "hub",
    "group": "worldwide",
    "children": [
      "indian-visa-application-uk",
      "china-visa-application",
      "schengen-visa-application",
      "usa-visa-services",
      "saudi-arabia-visa-uk",
      "ghana-visa-services",
      "russian-visa-services-from-uk",
      "sri-lanka-visa-services",
      "document-legalisation",
      "indian-passport-services",
      "second-uk-passport",
      "japan-visa-services"
    ]
  },
  {
    "slug": "indian-visa-application-uk",
    "type": "hub",
    "group": "worldwide",
    "children": [
      "e-tourist-visa-india",
      "e-business-visa-india",
      "employment-visa-india",
      "e-medical-visa-india",
      "e-medical-attendant-visa-india",
      "e-student-visa-india",
      "e-transit-visa-india",
      "visiting-family-in-india",
      "transfer-india-evisa-new-passport"
    ]
  },
  {
    "slug": "e-tourist-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "e-business-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "employment-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "e-medical-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "e-medical-attendant-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "e-student-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "e-transit-visa-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "visiting-family-in-india",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "transfer-india-evisa-new-passport",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "china-visa-application",
    "type": "service",
    "group": "worldwide",
    "related": [
      "china-tourist-visa",
      "china-work-visa-for-uk-citizens"
    ]
  },
  {
    "slug": "china-tourist-visa",
    "type": "service",
    "group": "worldwide",
    "related": [
      "china-visa-application",
      "china-work-visa-for-uk-citizens"
    ],
    "visa": "travel"
  },
  {
    "slug": "china-work-visa-for-uk-citizens",
    "type": "service",
    "group": "worldwide",
    "related": [
      "china-visa-application"
    ],
    "visa": "travel"
  },
  {
    "slug": "schengen-visa-application",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-visa-services",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "saudi-arabia-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "ghana-visa-services",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "russian-visa-services-from-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "sri-lanka-visa-services",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "document-legalisation",
    "type": "service",
    "group": "worldwide"
  },
  {
    "slug": "indian-passport-services",
    "type": "service",
    "group": "worldwide"
  },
  {
    "slug": "second-uk-passport",
    "type": "service",
    "group": "worldwide"
  },
  {
    "slug": "angola-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "benin-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ivory-coast-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "djibouti-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ethiopia-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "gabon-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "guinea-bissau-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kenya-eta-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "rwanda-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tanzania-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "uganda-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zambia-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zimbabwe-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "nigeria-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "azerbaijan-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "cambodia-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "myanmar-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "pakistan-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tajikistan-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "bahrain-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kuwait-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "oman-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "turkey-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "papua-new-guinea-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "japan-visa-services",
    "type": "service",
    "group": "worldwide",
    "visa": "travel",
    "related": [
      "japan-work-visa-uk"
    ]
  },
  {
    "slug": "japan-work-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "about-us",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "faqs",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "fees",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "complaints",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "privacy-policy",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "terms",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "disclaimer",
    "type": "info",
    "group": "company"
  },
  {
    "slug": "partner-with-us",
    "type": "service",
    "group": "company"
  }
];
