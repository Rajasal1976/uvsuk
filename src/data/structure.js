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
      "skilled-worker-dependant-visa",
      "care-worker-visa-extension",
      "care-worker-dependant-visa",
      "chef-visa-extension-uk",
      "post-study-work-visa",
      "sponsor-licence-application"
    ]
  },
  {
    "slug": "skilled-worker-visa-formally-tier-t2-general",
    "type": "service",
    "group": "uk",
    "related": [
      "skilled-worker-dependant-visa",
      "sponsor-licence-application",
      "indefinite-leave-to-remain-ilr"
    ]
  },
  {
    "slug": "skilled-worker-dependant-visa",
    "type": "service",
    "group": "uk",
    "related": ["skilled-worker-visa-formally-tier-t2-general", "chef-visa-extension-uk", "care-worker-dependant-visa", "indefinite-leave-to-remain-ilr"]
  },
  {
    "slug": "care-worker-visa-extension",
    "type": "service",
    "group": "uk",
    "related": ["care-worker-dependant-visa", "sponsor-licence-care-homes", "indefinite-leave-to-remain-ilr"]
  },
  {
    "slug": "care-worker-dependant-visa",
    "type": "service",
    "group": "uk",
    "related": ["care-worker-visa-extension", "skilled-worker-dependant-visa"]
  },
  {
    "slug": "chef-visa-extension-uk",
    "type": "service",
    "group": "uk",
    "related": ["skilled-worker-dependant-visa", "sponsor-licence-restaurants", "skilled-worker-visa-formally-tier-t2-general"]
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
    "slug": "uk-ancestry-visa",
    "type": "service",
    "group": "uk",
    "related": [
      "indefinite-leave-to-remain-ilr",
      "british-citizenship"
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
      "sponsor-licence-compliance",
      "sponsor-licence-by-industry",
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
    "slug": "sponsor-licence-compliance",
    "type": "service",
    "group": "employer",
    "related": [
      "sponsor-licence-application",
      "corporate-clients"
    ]
  },
  {
    "slug": "sponsor-licence-by-industry",
    "type": "hub",
    "group": "employer",
    "children": [
      "sponsor-licence-restaurants",
      "sponsor-licence-it-technology",
      "sponsor-licence-construction",
      "sponsor-licence-care-homes"
    ]
  },
  {
    "slug": "sponsor-licence-restaurants",
    "type": "service",
    "group": "employer",
    "related": [
      "chef-visa-extension-uk",
      "sponsor-licence-application",
      "sponsor-licence-compliance",
      "sponsor-licence-it-technology",
      "sponsor-licence-construction",
      "sponsor-licence-care-homes"
    ]
  },
  {
    "slug": "sponsor-licence-it-technology",
    "type": "service",
    "group": "employer",
    "related": [
      "sponsor-licence-application",
      "sponsor-licence-compliance",
      "sponsor-licence-restaurants",
      "sponsor-licence-construction",
      "sponsor-licence-care-homes"
    ]
  },
  {
    "slug": "sponsor-licence-construction",
    "type": "service",
    "group": "employer",
    "related": [
      "sponsor-licence-application",
      "sponsor-licence-compliance",
      "sponsor-licence-restaurants",
      "sponsor-licence-it-technology",
      "sponsor-licence-care-homes"
    ]
  },
  {
    "slug": "sponsor-licence-care-homes",
    "type": "service",
    "group": "employer",
    "related": [
      "care-worker-visa-extension",
      "sponsor-licence-application",
      "sponsor-licence-compliance",
      "sponsor-licence-restaurants",
      "sponsor-licence-it-technology",
      "sponsor-licence-construction"
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
    "type": "hub",
    "group": "worldwide",
    "children": [
      "usa-esta-uk",
      "usa-b1-b2-visa-uk",
      "usa-f-student-visa-uk",
      "usa-j-exchange-visa-uk",
      "usa-i-media-visa-uk",
      "usa-c1-d-crew-visa-uk",
      "usa-l-intracompany-visa-uk",
      "usa-o-visa-uk",
      "usa-p-visa-uk"
    ]
  },
  {
    "slug": "saudi-arabia-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "ghana-visa-services",
    "type": "hub",
    "group": "worldwide",
    "visa": "travel",
    "children": [
      "ghana-tourist-visa",
      "ghana-business-visa",
      "ghana-e-tourist-visa",
      "ghana-e-business-visa"
    ]
  },
  {
    "slug": "ghana-tourist-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "ghana-business-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "ghana-e-tourist-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ghana-e-business-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "russian-visa-services-from-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "travel",
    "children": [
      "russia-business-visa",
      "russia-tourist-visa",
      "russian-work-visa",
      "russia-student-visa",
      "russia-family-visa"
    ]
  },
  {
    "slug": "russia-business-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "russia-tourist-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "russian-work-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "russia-student-visa",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "russia-family-visa",
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
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "angola-tourist-visa-uk",
      "angola-business-visa-uk"
    ]
  },
  {
    "slug": "angola-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "angola-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "benin-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "benin-tourist-visa-uk",
      "benin-business-visa-uk"
    ]
  },
  {
    "slug": "benin-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "benin-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ivory-coast-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "ivory-coast-tourist-visa-uk",
      "ivory-coast-business-visa-uk"
    ]
  },
  {
    "slug": "ivory-coast-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ivory-coast-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "djibouti-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "djibouti-tourist-visa-uk",
      "djibouti-business-visa-uk"
    ]
  },
  {
    "slug": "djibouti-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "djibouti-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ethiopia-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "ethiopia-tourist-visa-uk",
      "ethiopia-business-visa-uk"
    ]
  },
  {
    "slug": "ethiopia-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "ethiopia-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "gabon-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "gabon-tourist-visa-uk",
      "gabon-business-visa-uk"
    ]
  },
  {
    "slug": "gabon-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "gabon-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "guinea-bissau-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "guinea-bissau-tourist-visa-uk",
      "guinea-bissau-business-visa-uk"
    ]
  },
  {
    "slug": "guinea-bissau-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "guinea-bissau-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kenya-eta-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "kenya-tourist-visa-uk",
      "kenya-business-visa-uk"
    ]
  },
  {
    "slug": "kenya-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kenya-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "rwanda-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "rwanda-tourist-visa-uk",
      "rwanda-business-visa-uk"
    ]
  },
  {
    "slug": "rwanda-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "rwanda-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tanzania-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "tanzania-tourist-visa-uk",
      "tanzania-business-visa-uk"
    ]
  },
  {
    "slug": "tanzania-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tanzania-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "uganda-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "uganda-tourist-visa-uk",
      "uganda-business-visa-uk"
    ]
  },
  {
    "slug": "uganda-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "uganda-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zambia-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "zambia-tourist-visa-uk",
      "zambia-business-visa-uk"
    ]
  },
  {
    "slug": "zambia-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zambia-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zimbabwe-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "zimbabwe-tourist-visa-uk",
      "zimbabwe-business-visa-uk"
    ]
  },
  {
    "slug": "zimbabwe-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "zimbabwe-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "nigeria-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "nigeria-tourist-evisa-uk",
      "nigeria-business-evisa-uk",
      "nigeria-tourist-visa-uk",
      "nigeria-business-visa-uk",
      "nigeria-str-work-visa-uk",
      "nigeria-temporary-work-permit-uk"
    ]
  },
  {
    "slug": "nigeria-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "nigeria-business-evisa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "nigeria-tourist-evisa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "nigeria-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "nigeria-str-work-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "nigeria-temporary-work-permit-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "azerbaijan-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "azerbaijan-tourist-visa-uk",
      "azerbaijan-business-visa-uk"
    ]
  },
  {
    "slug": "azerbaijan-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "azerbaijan-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "cambodia-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "cambodia-tourist-visa-uk",
      "cambodia-business-visa-uk"
    ]
  },
  {
    "slug": "cambodia-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "cambodia-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "myanmar-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "myanmar-tourist-visa-uk",
      "myanmar-business-visa-uk"
    ]
  },
  {
    "slug": "myanmar-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "myanmar-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "pakistan-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "pakistan-tourist-visa-uk",
      "pakistan-business-visa-uk"
    ]
  },
  {
    "slug": "pakistan-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "pakistan-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tajikistan-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "tajikistan-tourist-visa-uk",
      "tajikistan-business-visa-uk"
    ]
  },
  {
    "slug": "tajikistan-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "tajikistan-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "bahrain-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "bahrain-tourist-visa-uk",
      "bahrain-business-visa-uk"
    ]
  },
  {
    "slug": "bahrain-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "bahrain-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kuwait-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "kuwait-tourist-visa-uk",
      "kuwait-business-visa-uk"
    ]
  },
  {
    "slug": "kuwait-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "kuwait-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "oman-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "oman-tourist-visa-uk",
      "oman-business-visa-uk"
    ]
  },
  {
    "slug": "oman-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "oman-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "turkey-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "turkey-tourist-visa-uk",
      "turkey-business-visa-uk"
    ]
  },
  {
    "slug": "turkey-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "turkey-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "papua-new-guinea-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "visa": "evisa",
    "children": [
      "papua-new-guinea-tourist-visa-uk",
      "papua-new-guinea-business-visa-uk"
    ]
  },
  {
    "slug": "papua-new-guinea-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "papua-new-guinea-business-visa-uk",
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
    "slug": "thailand-visa-uk",
    "type": "hub",
    "group": "worldwide",
    "children": [
      "thailand-visa-exemption-uk",
      "thailand-tourist-visa-uk",
      "thailand-business-visa-uk",
      "thailand-family-visa-uk",
      "thailand-retirement-visa-uk",
      "thailand-dtv-visa-uk"
    ]
  },
  {
    "slug": "thailand-visa-exemption-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "thailand-tourist-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "thailand-business-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "thailand-family-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "thailand-retirement-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "thailand-dtv-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-esta-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "usa-b1-b2-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-f-student-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-j-exchange-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-i-media-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-c1-d-crew-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-l-intracompany-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-o-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "usa-p-visa-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "travel"
  },
  {
    "slug": "canada-eta-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "australia-eta-evisitor-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "new-zealand-nzeta-uk",
    "type": "service",
    "group": "worldwide",
    "visa": "evisa"
  },
  {
    "slug": "immigration-advice-manchester",
    "type": "info",
    "group": "local"
  },
  {
    "slug": "areas-we-serve",
    "type": "info",
    "group": "local"
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
