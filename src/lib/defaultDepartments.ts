import { DepartmentSeed } from "./types";

/**
 * The real TEDxNIFT Jodhpur departments, with the copy the team wrote.
 *
 * Seeded from Admin > Departments ("Add default departments"). Kept in
 * source so a fresh Firebase project can be brought up without
 * retyping any of it — the descriptions below are shown to applicants
 * on the agreement step, so they are content, not placeholders.
 */
export const DEFAULT_DEPARTMENTS: DepartmentSeed[] = [
  {
    name: "Decor Team",
    code: "DT",
    description: "The Decor Team is responsible for planning and setting up the visual environment and ambience of TEDxNIFT Jodhpur.",
    purpose: "To create an aesthetic, welcoming, and memorable event atmosphere that reflects the TEDxNIFT Jodhpur theme and identity.",
    responsibilities: "Plan the overall decoration and event setup.\nDesign and arrange stage, entrance, registration, and common areas.\nCreate creative installations and display elements.\nCoordinate with the Design, Production, and Logistics teams.\nArrange and manage required decoration materials.\nSet up and remove decorations before and after the event.",
    guidelines: "Follow the approved event theme and visual identity.\nKeep the setup clean, organized, and professional.\nAvoid unnecessary expenses and use materials responsibly.\nEnsure all decorations are safe and do not obstruct movement or emergency exits.\nComplete setup within the assigned timelines.\nGet major decoration plans approved before execution.",
  },
  {
    name: "Design",
    code: "DS",
    description: "The Design Team is responsible for creating the visual identity and creative assets for TEDxNIFT Jodhpur across digital and physical platforms.",
    purpose: "To create visually engaging, consistent, and impactful designs that communicate the TEDxNIFT Jodhpur identity and enhance the overall event experience.",
    responsibilities: "Create posters, social media creatives, banners, invitations, and other event materials.\nDevelop designs according to the event's theme and visual identity.\nWork closely with the Social Media, PR, Sponsorship, and Production teams.\nDesign event-related physical materials such as standees, backdrops, and signage.\nMaintain consistency in fonts, colours, layouts, and branding.\nMake design revisions based on feedback from the core team.\nManage and organize design files for easy access and future use.",
    guidelines: "Follow TEDx and TEDxNIFT Jodhpur branding guidelines strictly.\nMaintain consistency across all designs and platforms.\nDo not publish or share designs without approval.\nMeet deadlines and communicate early if additional time is required.\nKeep editable/source files organized and backed up.\nEnsure all images, fonts, illustrations, and other assets are properly licensed or approved for use.",
  },
  {
    name: "On-Ground Management",
    code: "OGM",
    description: "The On-Ground Management & Logistics Team is responsible for managing the physical arrangements and smooth execution of TEDxNIFT Jodhpur on the event day.",
    purpose: "To ensure that all on-ground operations, movement, arrangements, and logistics run smoothly before, during, and after the event.",
    responsibilities: "Manage venue setup and on-ground arrangements.\nCoordinate seating, entry, registration areas, and audience movement.\nHandle transportation and movement of materials when required.\nCoordinate with vendors and other departments on event day.\nEnsure required materials and resources are available at the right place and time.\nAssist speakers, guests, and attendees with on-ground requirements.\nHandle unexpected on-ground issues and coordinate quick solutions.\nManage setup and teardown of the venue.",
    guidelines: "Be punctual and available during assigned shifts.\nStay alert and proactive throughout the event.\nCommunicate clearly with other teams and the core team.\nDo not make major logistical decisions without approval.\nHandle event materials and equipment responsibly.\nPrioritize safety, cleanliness, and a smooth attendee experience.",
  },
  {
    name: "Operations & Production Team",
    code: "OP",
    description: "The Operations & Production Team is responsible for planning, coordinating, and executing the physical and technical requirements of TEDxNIFT Jodhpur.",
    purpose: "To ensure the event runs smoothly, efficiently, and according to plan from setup to closing.",
    responsibilities: "Manage venue setup and event-day operations.\nCoordinate stage, seating, backstage, and event areas.\nHandle event logistics, materials, and equipment movement.\nCoordinate with vendors and external service providers.\nManage backstage and speaker movement.\nCoordinate the event schedule and on-ground execution.\nWork with Technical, Decor, Sponsorship, and other teams for event requirements.\nHandle setup, event-day operations, and teardown.\nResolve on-ground operational issues quickly.",
    guidelines: "Be punctual and available during assigned shifts.\nFollow the event schedule and instructions from team leads.\nCoordinate with other departments before making changes.\nHandle equipment and materials responsibly.\nMaintain safety, cleanliness, and proper event flow.\nReport operational issues immediately to the team lead/core team.",
  },
  {
    name: "PR Team",
    code: "PR",
    description: "The PR Team is responsible for creating awareness and generating public interest around TEDxNIFT Jodhpur. Volunteers will work on media outreach, communications, collaborations, and promoting the event to the right audience.",
    purpose: "To build a strong public presence and buzz around TEDxNIFT Jodhpur through effective communication, media relations, and outreach.",
    responsibilities: "Reach out to media houses, publications, influencers, and relevant communities.\nPromote the event through PR campaigns and collaborations.\nDraft and share press releases and event announcements.\nBuild relationships with media and external organizations.\nCoordinate with the Social Media and Content teams for promotions.\nTrack media coverage and maintain a record of PR activities.\nHelp increase event visibility and audience engagement.",
    guidelines: "Maintain professional and clear communication with external contacts.\nEnsure all information shared publicly is accurate and approved.\nDo not make statements or commitments on behalf of TEDxNIFT Jodhpur without approval.\nFollow the event's branding and communication guidelines.\nMaintain a professional relationship with media, influencers, and partners.\nCoordinate with the core team before publishing or distributing official PR material.",
  },
  {
    name: "Social Media",
    code: "SM",
    description: "The Social Media Team manages the online presence and digital promotion of TEDxNIFT Jodhpur, creating content that connects with the audience and builds excitement around the event.",
    purpose: "To increase reach, engagement, and awareness of TEDxNIFT Jodhpur through social media.",
    responsibilities: "Manage TEDxNIFT Jodhpur's social media platforms.\nPlan and publish posts, stories, reels, and event updates.\nPromote speakers, sponsors, and important announcements.\nCreate engaging content and trends around the event.\nCoordinate with the Design, PR, and Content teams.\nMonitor engagement and audience responses.",
    guidelines: "Follow TEDx branding and social media guidelines.\nGet approval before posting official content.\nKeep all information accurate and updated.\nMaintain a professional, creative, and consistent tone.\nDo not share confidential or unreleased information.",
  },
  {
    name: "Sponsorship",
    code: "SP",
    description: "The Sponsorship Team is responsible for finding, contacting, and coordinating with potential sponsors for TEDxNIFT Jodhpur. Volunteers will research brands, reach out to companies, present sponsorship opportunities, follow up with leads, and help secure financial or in-kind support for the event.",
    purpose: "To secure financial and in-kind support for TEDxNIFT Jodhpur by building meaningful partnerships with brands, companies, and organizations while creating value for both the sponsors and the event.",
    responsibilities: "Research and identify potential sponsors and partners.\nContact brands, companies, and organizations through calls, emails, and messages.\nPresent sponsorship opportunities and explain the benefits of partnering with TEDxNIFT Jodhpur.\nFollow up with potential sponsors and maintain communication.\nHelp negotiate and finalize sponsorships under the team’s guidance.\nCoordinate with confirmed sponsors and ensure promised deliverables are fulfilled.\nExplore both financial and in-kind sponsorships for the event.",
    guidelines: "Maintain professional and respectful communication with all potential sponsors.\nResearch each sponsor before reaching out and approach relevant brands.\nDo not make promises or commitments without approval from the Sponsorship Head.\nKeep accurate records of all contacts, responses, and follow-ups.\nFollow up regularly but avoid excessive or repeated messages.\nCoordinate with the team before finalizing any sponsorship.\nFollow all TEDx guidelines and event policies while communicating with sponsors.",
  },
  {
    name: "Technical",
    code: "TC",
    description: "The Technical Team is responsible for website management, registrations, and technical support throughout TEDxNIFT Jodhpur.",
    purpose: "To ensure a smooth digital and technical experience for attendees, speakers, and the organizing team.",
    responsibilities: "Manage and update the event website.\nHandle the online registration process and attendee data.\nProvide technical support to attendees and the organizing team.\nManage registration-related technical issues before and during the event.\nCoordinate with other departments for website and registration requirements.\nEnsure a smooth check-in and registration experience at the event.",
    guidelines: "Keep all registration and attendee information accurate and confidential.\nRegularly check and update the website.\nTest registration systems before the event.\nRespond to technical issues quickly and professionally.\nCoordinate with the core team before making major changes.\nEnsure all technical systems are ready and tested before the event.",
  },
];
