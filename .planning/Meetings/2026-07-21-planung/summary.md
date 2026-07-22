July 21, 2026
Meeting on July 21, 2026 at 18:36 CEST
Meeting recording transcript 


Summary
Project development focused on a gamified character system to increase user engagement through token consumption metrics and visual animations.

Level mechanics and tracking
The system is based on token consumption for leveling up to 32. Data is stored in aggregated form to preserve scalability.

Architecture and character design
PixiJS enables character animation based on JSON configurations. A flexible layer structure ensures visual consistency across age stages.

Strategy and monetization
The platform establishes a brand with a prestige system for long-term motivation. It was decided not to include traditional advertising, but to offer cosmetic assets instead.


Next steps
Research benchmarks: Research whether intelligence indices can be used as a metric for experience point calculation.
Data model prototype: Develop a prototype for the token- and intelligence-index-based data structure.
Level design table: Create a table for the level design including sprite sets, animations, and triggers.
Define age stages: Develop reference images for the baby, teenager, and adult stages. Break these down into individual body parts for the animation.
Define levels: Define the game mechanics and progression for the 32 levels. Define the conditions for the characters' growth.
Create animation prototypes: Develop technical concepts with PixiJS for the sprite animations. Test combining different assets for the characters.
Develop XP calculation: Design a method for calculating experience points and level. Integrate an intelligence index model for the ranking.
Optimize asset workflow: Adjust the ComfyUI process so that all components are generated as separate layers. Ensure body parts are layered correctly on top of each other for consistent animations.
Create documentation: Document the platform and processes to ensure contribution readiness for external collaborators. Prepare all tasks for internal collaboration.
Implement data storage: Configure local storage of profile data in a configuration file. Prepare the infrastructure for a later migration to user authentication.
Create beaver stickers: Design stickers for the project using the available character images. Use cloud or image generation tools for this process.
Develop security mechanism: Development of a security mechanism for externally controlling animations to prevent unauthorized manual activation by users.
Implement naming: Implementation of a feature that allows users to give their beaver a custom name at the start of the application.
Easter egg animation: Creation of a special animation in which the beaver interacts with the official logo.
Integrate status detection: Integration of the Herdr logic to automatically detect when a coding agent has finished its work.
Account linking: Development of the linking feature to connect the local beaver with an AI Beavers web profile and sync achievements and XP.
Create API documentation: Creation of technical documentation explaining the asset builder workflow and the necessary PixiJS skills to contributors.


Details
Definition of the level mechanics: It was decided to base the project's level system on the number of tokens consumed, rather than on time or other metrics, in order to launch a clear V1 version. The goal is gradual progress up to level 32, with the effort required to reach the higher levels increasing continuously (00:54:38).
Data collection and tracking: It was discussed to record the token consumption of the different models. It was established that daily, aggregated storage of the data is necessary, differentiated between the various models (00:54:57) (00:58:57).
Technical implementation of tracking: It was clarified that `npx` is being considered for using TokScale to enable easy installation and use, while versions must be managed securely (01:00:15) (01:01:01).
Model selection and token calculation: It was agreed to primarily use input and output tokens from all common models for calculating experience points (XP), while excluding cache data to avoid double counting (01:03:06).
Structuring progression: The level system was roughly defined: levels 1 to 16 represent a development phase (e.g. "baby" to "teenager"), with the progression speed intended to be high initially to strengthen user retention (01:04:16) (01:13:51).
Playful elements and Easter eggs: The idea was discussed of integrating playful elements such as controlling a character (similar to the Google Dino game) as an Easter egg for higher levels to increase entertainment value (01:06:21).
Data storage and scalability: To avoid overloading the database, it was decided not to store huge amounts of raw data, but only the date and the aggregated token values (input/output) per day and model (01:10:50).
Visual interaction and animation: To increase user engagement, small visual changes or interactions should take place early on (from level 8), such as a click trigger that sets off an animation (01:12:08) (01:18:00).
Technical stack for animations: PixiJS was identified as a suitable engine for the visual implementation, as it supports sprite rendering and the handling of animations as well as collisions (01:15:27) (01:37:51).
Future monetization: The possibility of offering special assets in exchange for contributions or donations in the future was discussed, with the current focus on reaching a significant user base of around 1,000 active users (01:38:58) (01:40:24).
Character map and JSON structure: It was decided to use a JSON-based structure ("character map") to define levels, associated sprites, and animations, allowing flexible extensibility (01:30:53) (01:32:48).
Benchmarking model intelligence: It was discussed how different models could be weighted based on their price-performance ratio and intelligence benchmarks to ensure fair XP awarding (01:23:57) (01:29:09).
Event triggers: In addition to progression through token consumption, various triggers for animations were defined, including drag-and-drop interactions, time-controlled events (e.g. midnight), or notifications (01:32:03) (01:32:48).
Project roadmap and milestones (Cycle 1): The first cycle was defined, with the main goals set as a working, downloadable app, 100 downloads, and recruiting 7 additional contributors to complete Cycle 1 status (01:53:08) (01:54:39).
Development timeline and level definition: Two months are set as the time frame for reaching level 32 (01:55:35). There is a need to define this average value in order to plan the development speed and workload accordingly (01:55:59).
Platform extensibility: To enable future updates without reprogramming the application, the project should be designed so that animations and sprites can be added via external configuration files, such as JSON files (01:59:56).
Main features for Cycle 1: A "recording agent" was identified as the central feature for the first cycle (02:01:30). Additionally, a notification function should be implemented that reacts to external events, such as when input from a coding agent is required (02:02:01).
Separation of event logic and character animation: The architecture should be built so that one module handles monitoring external agents, while a separate module controls the corresponding character animation (02:05:22). The logic for detecting states, such as a waiting terminal input, could for example be adopted from existing models like Herdr (02:06:13).
Prototyping for XP calculation and animation: To validate technical feasibility, prototypes should be created for the XP calculation and for the clean implementation of animations (02:07:16). These serve as important milestones before further scaling of the project (02:08:42).
Data storage and authentication: For the first cycle, storing data in a local configuration file is planned in order to work without user authentication (02:11:46). A later implementation of authentication (e.g. via Google or AI account) and data migration to a database are planned as future extensions (02:10:25) (02:12:37).
Milestone planning and documentation: The plan includes prioritizing tasks into milestones, starting with preparation for external contributions (02:13:41). The documentation should ensure that internal coding agents can continue working on the project efficiently (02:14:20).
Character stages and visualization: It was decided to divide the character into different age stages (e.g. baby, teenager, adult) to represent growth (00:02:17). For this, reference images of the characters from different perspectives (front, side, back) in pixel art quality are required (00:02:37) (00:03:35).
Asset generation and layering: The character assets should first be created in a "naked" base form, onto which further elements such as clothing or accessories can be added as layers (00:04:45) (00:06:39). This ensures consistency across different age stages and operating systems (00:05:22).
Automated animation: Instead of generating complete scenes, individual body parts should be created as assets to simplify animation through targeted assembly and layering of the layers (00:07:40) (00:08:53). For this process, adjustments should be made to the prompt workflow in tools like ComfyUI (00:12:47).
Character name and identity: It was agreed that users can give the character their own name at the start, similar to the concept in Pokémon (00:21:51). This serves personal attachment, while the "AI Beaver" brand should remain as the overarching branding (00:21:11).
Special animations and Easter eggs: The idea was discussed of building in special animations triggered for example by certain events or random probabilities (00:22:28) (00:27:43). This includes complex depictions such as the character appearing with an airplane and a banner (00:23:01) (00:26:20).
Interface to external agents: The application should be logically linked to external coding agents to inform the user about states such as "input needed". These notifications should happen visually through the character, for example by holding up a sign (00:23:57) (00:25:35).
User interaction and design: Usability (UX) was discussed, in particular the functionality of moving the character via drag-and-drop (00:33:23) (00:34:26). The goal is intuitive control where the window remains interactively usable below the character despite the overlay character (00:34:43).
AI Beaver branding and monetization: The project should be established as a strong brand, giving users the option to purchase clothing and cosmetic items for small amounts (00:36:20). It was emphasized that this is not "pay-to-win", as these items can also be unlocked through progress in the level system (00:36:48). Additionally, the possibility of producing and selling physical merchandise such as T-shirts was discussed (00:37:04).
Launch strategy and usage statistics: After the launch, the system should be observed to evaluate response and user numbers (00:37:38). The aim is not only to record installation of the program, but to track the actual active usage time with the laptop open, in order to use time as a measurable value for the system (00:37:59).
Gamification and achievement system: It is planned to convert time into experience points (XP), with lifetime being used to unlock special assets or progress (00:38:21). An additional achievement system for milestones, such as "7 days" or "30 days" of active time, was discussed to promote user retention (00:38:52).
Profile system and landing page: The website ai-bibers.com should serve as the central platform for the "Beaver Buddy", where users can link their local data to their account (00:39:59). Through this link, profiles can be created that display XP, achievements, and the character's progress. Local use without account linking should also remain possible (00:40:50).
In-app marketing concept: Instead of traditional forms of advertising, the plan is to use the "Beaver Buddy" as an interaction medium. Through speech bubbles, the character can point out offers or perks without this being perceived as traditional advertising (00:41:08).
Current development status: Currently, using the program requires launching it via the console, which limits accessibility for regular users. The goal is a user-friendly application that can be opened directly (00:42:07).
Level system and prestige concept: The level structure is designed with a cap at level 32, with progress achieved through tokens or time (00:42:28). A prestige system was proposed in which users can start over at level 1 from level 32 to receive visual markers such as stars and incrementally unlock seasonal content (00:42:45) (00:43:32).
Scaling strategy for contributors: To enable further development by a community, a solid technical foundation with an API interface, database connection, and user accounts should be created. Once this framework is in place, developers can contribute their own ideas, which are integrated with quality assurance via a review process (pull requests) (00:45:08) (00:46:17).
Technical asset builder and documentation: An "asset builder" should be developed for extending assets, such as new character models or animations. The technical requirements, such as the use of PixiJS and compilers, have already been recorded in documentation (README file) to make it easier for contributors to get started with development (00:47:20) (00:48:03).


Review Gemini's notes to make sure they are correct. Find tips here and learn how Gemini takes notes.
How do you rate the quality of these notes? Take a short survey and give us feedback — for example, on how helpful these notes were.
