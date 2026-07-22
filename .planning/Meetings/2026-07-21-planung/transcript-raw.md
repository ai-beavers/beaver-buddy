July 21, 2026
Meeting on July 21, 2026 at 18:36 CEST - Transcript
00:00:03

Okay, this conversation is about defining the stories for the beaver for an open source project. Yeah, the stories and the big did, so that I can also uh start the image image loop and get some stuff cranked out without us having to babysit it the whole time.


00:00:27

And I'd say, um, what we have, what do we have now, let's break down what we already have and what we still need so that it works autonomously. Exactly. So we need to clearly define which cycles uh the beaver will have. Yeah, so that we have the assets for it one to one and have clear templates.


00:01:03

That means, for example, the clothing has to stay the same no matter the state, unless of course it's some kind of special thing. Um, let's say he's now this one uh Jenk, let's say Jenk. Yeah, for example, you can earn Jenk uh if you attended two community events. Jenk is like the standard, then we already have that as a personal brand thing.


00:01:31

You have to have checked in at Luma twice, so to speak, or whatever, something like that. Yeah, but that — I mean I'd like to keep it as simple as possible now, because this is just so that we define it early too, since this conversation is being recorded right now. I understand that, but I wouldn't define it completely, I wouldn't define it that far — I want the basics first, because we don't have those yet.


00:01:58

I'd say about this beaver we have now — we have kind of a baby mode, right? Yeah. First of all, he doesn't crawl for you. That's broken on Windows. I know. Um, I'd like to define once how we handle that, how the beaver looks, so to speak. You already said that well.


00:02:17

So we have a baby beaver, right? Level 0 to 16, let's say, right? Um, then we need another one that's 16 to 32, e.g., right? Like the levels of the teen teen thing, the way it looks now, I'd say. Then there's one that's a bit older already, like level 32 to 34, right?


00:02:37

Okay. Um, we have to define what makes them grow, so to speak, and then we have to, with PixiJS, we have to, so to speak — we have to define them once from the front, left, right, back. Right? Uh, no, no. What we need is, from every uh age state we need an image like the one I uploaded to Google Drive.


00:03:12

Well, you didn't quite — that's from Alex. Okay, so that's — he should actually be drivable in any case. Exactly. Jenk the big beaver and then like that. Okay, like that. Yeah, exactly. Yeah, exactly. I mean from the front, from the side, and from the back.


00:03:35

Ideally even from the other side, but that would almost be over the top. So as long as you have that, you can work with it, and we need that of the beaver as pixel — as pixel art — and then we can use these images from small to middle-aged, so every single age stage, with these images that have three reference images from different positions in them.


00:03:58

Yeah, okay. So we have to define them once, generate them once, and then they always have to be safe. Exactly, those are the main parts that community people shouldn't modify either or whatever — that's this self point. Um, maybe we could — should we go, let's say, female and male? No, let's do male for now.


00:04:19

Only male, because that's so complicated. t***** with pixels is a bit tricky, right? Yeah, for now let's leave it male and then — and then we'll see. Look. Okay, that means we definitely have to define them, and then from that, with PixiJS so to speak, all the body parts have to be removed again — shredded, so to speak — so that the head, um, arms, legs, and tail all come apart, right?


00:04:45

Yeah. Yeah, sure. Sure, yeah, that too. Yeah. And no, we can look at that, because ideally we'd really have a reference image, even of the T-shirt or the chain. But I'd say we make them naked for now. Yeah. Yeah, exactly.


00:05:02

Naked first, so that they're all naked. Then we have a base form. Just like he is there now, exactly a base form, because e.g. for me — that was one thing I noticed. Um, make yours also go down. Look, now let go. Look how these parachutes differ completely.


00:05:22

Yeah, those are completely different. Yeah. And uh, from — exactly. Assets are being created. First basic assets like this, and then, so to speak, they get coupled together. Mhm. Because Windows and Mac have to be exactly the same visualization. Yeah, you visualized that.


00:05:41

On Mac it looks exactly the same for me. Look, baby, you. Ah, okay. That — that's not the problem, but the — no, but I didn't know that, but it should still be consistent across every age — the parachute looks the same. Exactly. So we have to define these stories once, which stories will exist, and then with those stories we have to generate the assets one time.


00:06:19

Yeah, because the desk, no matter whether it gets bigger or smaller depending on age, will still stay the same desk. It should. But just like the T-shirt stays the same T-shirt, so that it adapts. Possibly a special thing. The T-shirt suddenly has no sleeves anymore. Yeah.


00:06:39

Oh, muscle T-shirt. Yeah, exactly. But exactly, we make naked beavers first. Exactly. Then we make the T-shirts. So all the main assets have to be generated and ready once. Exactly. And then we just match them. That should work.


00:06:55

We'll probably do that in ComfyUI then. What? Just put them together and then it generates the images. Exactly. Exactly. And even Claude can do that itself with this image input. Yeah, the problem is always — ComfyUI isn't a stable thing that always generates the same thing.


00:07:15

So if we now say we take the beaver and we take the black T-shirt, that he then also generates the walking and everything else correctly, because that has to happen too, because then the walking has to be generated, right? The parachute, the whole animation has to be generated. Exactly, we also have to define there, okay, there's this normal walking animation now.


00:07:40

Per age group it will always stay the same. Yeah, we generate the main character once for each age group and then we cut the individual parts of the body apart, so to speak, and generate the individual body parts, and then the individual body parts get assembled and animated. Okay. Does that work well? Have you ever had a good result?


00:07:59

Because what — that's what I did. Look, this here is e.g. um — this is e.g. made from these combined body parts or the uh general image input, but this one here was completely generated by Claude and Claude generated the individual parts. So I think actually it should — wait, how much difference is there really?


00:08:28

Okay, the tail does differ a bit. I don't think so. I don't think so either. I don't think it uses PixiJS, I think it uses — the whole time — and — yes it does, I can see it, if you look there, when I let him fall now, he has the tail slightly cut off. So the tail was really glued on.


00:08:53

Yeah, but that's not good quality — well, then it's just easier to generate it with ComfyUI. The problem is, when it goes to scale, you have to generate everything, right? Generate — that's not possible. That's — no, no, that's why the individual parts, because the individual parts can help us animate it more easily, if it's animated correctly.


00:09:22

It will animate correctly. Well, one animation he made was crap, but otherwise it's completely okay. I also said something like e.g. uh — no, that's okay. Look, when — yeah, but there e.g. an extra asset was created. Not a complete extra asset, but it was co-generated directly by ComfyUI with Gemini, this animation from below.


00:09:46

The — only the system prompt has to — not the system, but the prompt for generating the sprites for this Gemini generation comp has to be better in that moment, because Gemini still does this uh thing — do the animation again. Those are the ones, when he falls, that this dust just comes up. Yeah, the problem is that he's not growing right now.


00:10:14

I can't write that. Exactly. But this animation when he hits the ground, e.g. with these assets — that's one thing, we have to include that in the prompt in ComfyUI. Yeah, he must not uh bring other things into the sprite animation — they have to be clearly separated assets, because the assets for the beaver falling will actually always stay the same, unless we decide something else for a specific animation.


00:10:47

But otherwise only the size of the sprite is adjusted by the animation and placed on a specific layer. Yeah. Yeah, hopefully. No, that can — that will be done that way, 100%. Okay, good. But exactly, we have to define that now, right? What kind of action we need.


00:11:08

Um, but that means we probably have to um — I've lost my train of thought. Um, probably define the individual levels manually once, right? Yeah. Exactly. So mechanically uh we can't get out of that. So we have to define these things uh — define the individual levels, plan them, but the generation can happen autonomously.


00:12:47

We just have to review the finished asset animations once more. The assets themselves we only have to define once and clearly specify in the agent — email — that assets always have to be generated individually and then stacked as, so to speak, uh — what's it called? — as layers on top of each other, and that they may only ever be generated separately, and that the prompt in the ComfyUI workflow has to be adjusted.


00:13:18

Yeah, wait. Okay, then we've got that. Then I'd actually say, let's already discuss a few um — because bro, we have so many ideas. I'd say we can also start directly with the ones in this pile, um, with our transcription that we already did once. I created them as tasks on my end.


00:13:50

Mhm. We could e.g. use one of these animations that we already have as tasks, like the toilet flush. Um, e.g. there the toilet would have to be created as a single asset. Mm. Then e.g. the wave that comes would also have to be generated as a single asset. The facial expression like, oh my God, it's coming.


00:14:14

The head would have to be generated as a single one. Yeah, and that makes sense. Then the body stays the same. Mhm. Because that's the whole problem right now. Every time something different gets generated. Mhm. And suddenly different body colors etc. Yeah, okay. Then we've got that, and then we've got the other thing for the first stories, so to speak.


00:14:37

Mhm. Now we just have to define levels. Mhm. I'd actually say up to level 32 he grows based on tokens and then — because then he looks cool. It's so cool when he walks around, when you want him really jacked and really super swole, gym-style, and then you have to show MRR. Mhm.


00:15:14

Because then it starts getting difficult, right? Mm. Mhm. Because otherwise what happens if we directly say MRR — then everyone has a baby the whole time, right? That's lame. Mm. I'd even say you have to do a combo, man — members who come regularly also grow over time.


00:15:47

I grew the same way over time. Yeah, I've arrived, bro. I was a noob. Says uh — here AI S LinkedIn outreach — the first ten times it was the same and I had two pilot customers. Mm. Where am I now? Zero pilot customers. Where am I now?


00:16:04

Zero pilot customers now. I'm — what a bang from AI Beavers. Yeah, but you can't define it like that in that sense. M — make it as simple as possible, and I think that's the simplest way, because otherwise we over-complicate it and they just can't ship it. I mean, it can already be predefined for the future.


00:16:42

Can we record that now? Mhm. So animations shouldn't be unlocked directly either, they have to be activated somehow with uh external logic, with random things, because otherwise anyone who feels like it can say: "Oh, I see, it's open source, I'll just activate the next stage for myself." Cringe,


00:17:24

we don't want that either. We have to have some kind of security mechanism there. Oh. Because otherwise everyone who's a contributor can suddenly say: "Ah, I see, the repo is open source, dude, I'll instantly become the happiest and fake this API with Stripe." True. A verification with uh — with the platform you already have.


00:17:50

Do you already have the AI platform? Just with email. Or connect some Luma thing, dude. Even if it's just an agent that checks how often a member attended which event in Luma. But — is that so important? No, but we can predefine it already, bro.


00:18:13

For the start, we need more contributors. Yeah, but you can already have this clear goal, dude. In the end we want people tied to this AI Beaver website platform and possibly even have a community app. Okay, sounds good. We don't necessarily want to rebuild a second Discord or a second WhatsApp now, but a community app where it's simply possible — let's say you want to notify the community about something but don't want WhatsApp,


00:18:51

Build Fridays or whatever — you can just send push notifications to people's phones? No, announcing is also also possible, but it still has to be connected to the logic of your website. It has to be one overall architecture. Otherwise it's pointless if you have five servers. Yeah, okay. But that comes later.


00:19:11

That's not so important now. I'd say now that we have a basic concept that works, more contributors have that, and then we can develop it further, because right now it's very tied to us. That's not so cool. Completely tied to us. Yeah. And when we ship that in the first version, so to speak, mhm,


00:19:33

which is uh okay, then um exactly, then we can look further. Okay. But do we agree that it's Jenk for now? No. Why? Why is it Jenk? Because Jenk is the main character. I really want to build this pipeline so that videos are really feasible for us, where he maybe — there's still a bit of manual cutting effort needed from my side, but so that this personal brand really emerges and he's more than just a beaver and more than


00:20:08

just an AI beaver, but that there's really a main AI beaver. Exactly, but that's exactly why I'd say it's not Jenk — it's everyone's personal beaver, and Jenk comes in here sometimes and announces something or something totally crazy, because Jenk doesn't belong to Jen — he's the AI beaver, and he comes from below or something, down with the parachute, uh, Build Fridays in 12 cities at the same time or something, and then he takes off again, gives you a high five and takes off again,


00:20:45

because that's a very good idea. Yeah. Yeah, because then it's really crazy. And then we have Jenk as our character. You can't have him, so to speak, but he's still programmed so that sometimes we — we can only have ambassadors, so people who really uh contribute in the sense of community contributing. Yeah, something like that.


00:21:11

Yeah, or we really control him completely. Yeah, dude. Whoa, but how do we still do the branding then? Hm, the beaver still has to have an AI Beaver branding. Whether it's now um — it has to have more branding somewhere. It's a f****** beaver. So, when on the app — it's a f****** beaver.


00:21:36

What do you want? You know who you downloaded it from. Yeah, but strangers don't know who downloaded it. It needs a name. It needs a name. He needs a name. Yeah, that's the Beaver Buddy. You can name him. We can set that at the beginning.


00:21:51

You can give him a name when he uh — first he should hatch in the middle. Here maybe like AI Beavers something. He hatches here in the middle. Give him a name. Give me a name, he says. Blabla. Uh, first he says in baby talk, bl — give me a name, you know?


00:22:09

And then you have to enter a name. Yeah, I agree with that — like a Pokémon, because as a user you have to be able to give him a name, because otherwise — cringe, dude, people say: "Oh I see, that's my beaver." No, it needs branding. I am — I'm Jenk, I'm not — okay. No, mine I'll call Hans.


00:22:28

I'm Hans from AI Beavers. Yeah. Yeah, I'm your personal beaver. Yeah, that's good. So we also have to build that once, that we can type it in, and an Easter egg that every AI beaver has. We have to build in something like — no idea — the laptop's motion sensor, no idea, you do something with the camera, whatever, so that this beaver has a massive animation that has something to do with the logo.


00:23:01

Okay, something, something. For example, the logo appears, lots of beavers fall out of the logo. He briefly walks away and then he flies by in a plane with a banner behind it. A what? Oh, exactly like that. Exactly like that. That's cool. He — he suddenly pulls on an aviator helmet and then, like, you know, a scarf, and then it goes on with just a speech bubble.


00:23:29

Hey, chill for a sec, chill for a sec, and doing it so perfectly. And then a fat beaver logo here. Oh, that would be sick. Yeah, and we can do that at launch. We have to look at Herdr. Herdr is open source. Yeah, what logic does Herdr use to check which uh coding agent you're currently using and when it's done?


00:23:57

This "when it's done" — we can use this output signal too, and then he always has — like, Claude needs you, or [Codex] needs you — without the message. He shows — he shows a sign and then like, Claude. Exactly, exactly, exactly. Hey Jurij, we need input, input, input. Come here real quick, bro. Come, come here real quick.


00:24:20

Minutes, where's the Codex, bro. Bro, come here, 5 minutes. I'll set a timer. What? We're talking, bro. You have input too. I started a 5-minute timer. Wrap yours up. Jurij, you're already done for today.


00:24:34

No, it's not work. Not even started — it's an app, web app. Whatever, I don't want to — let's go. Okay, so what we just said was: Herdr is open source. We can also use this logic Herdr has for detecting when an agent is done, because Herdr also detects which agent is done from which provider.


00:25:00

That means we can adopt it one to one, and the beaver then has a specific sign or symbol or animation that says: "Hey, Codex needs you. Hey, Codex needs you." A small one with audio. Not with audio. But hey, have you really seen this "hey, Codex needs you" — this notch thing? In the notch something gets uh expanded and then it says "approve" small — and yeah, I saw that too, that was on Twitter.


00:25:35

Yeah. Something like that would be cool, right? So not just "Claude needs you", but maybe he says "do you want to approve" or the small ones, because then you wouldn't even have to go back into the app. You're scrolling TikTok or watching YouTube Reels and then he briefly says uh — apply, approve, whatever, no idea. Yeah, cool.


00:25:54

Click and then he does the sign. Mhm. We need uh iPhone iOS support for a widget. Future. Hey, we're talking about the future right now. Not future — we'll get there fine, bro. Talk — we'll really get there. Oh, just an iOS widget with AI — cool that you're so excited.


00:26:20

That's really cool. He said he needs — the AI Beavers logo has to appear somehow. Yeah, he puts on a helmet, an aviator helmet with a scarf. You have to — you have to knock on him five times. He gets angry. He's like, hey, wait a moment. He walks off screen. He walks off screen, you hear these stomping sounds, then a plane flies by, and then there are these two Twin Towers and he flies into them.


00:26:53

No, really. Yeah, that's only if you have a Turkish name — okay, okay, Gemini, not that, not that — if you think really darkly, then — I don't even want to say it. Already in September. No — no no no no no no no no no. You didn't hear that. You know what?


00:27:20

Okay. Um, exactly. Then he flies with the plane, right? Then there's a banner in the back, like, rattling, so cool. Um, sometimes we could also have him pitch a tent or something. Totally sick. Mhm. Mhm. Um, yeah, I — we definitely have to think about how we build this logic so that the user can't decide himself which things, uh, which sprites are in there.


00:27:43

What do you mean? Sprites, animation. Oh, I see — animations get loaded from outside. No — so what I did here, this laptop animation, he does it 5% of his whole time. So when he's in idle mode, just standing, then there's a 5% probability that he suddenly goes to the laptop. Yeah, but these probability things are easy to adjust.


00:28:07

Yeah, we don't actually want that. Why? You can't just blast the whole animation. It's supposed to happen randomly, right? Exactly, it's supposed to happen randomly, but this randomness should be determined from outside and not from inside. And what does "from outside" mean? I mean, I really imagine that the animation comes.


00:28:29

He's in the mood for something and then the animation fires. No, I think of it much more as being managed from a server, bro. Not that I sit there and manage, dude, who has which — it's over-complicating it, right? Are you some kind of Fable or what? Look, bro. I meant for the start anyway.


00:28:53

So, yeah, but another thing, bro — not every user should have every animation directly available, and most of them can — AI people come into our community. That means if you already have all these animations on your laptop, then you can prompt every state of the beaver yourself. No, that's not the goal. That — no, it's really supposed to be branding. For the start you can leave it like you say.


00:29:19

There's a secret there, right? Security-wise, right? If someone has the thought of reverse-engineering it somehow and manages to pull something off, he'll pull it off. Even with your solution with the server — even then he'll pull it off. The really big game developers always try to suppress these hackers who build cheats.


00:29:43

Yeah, but bro, those are cheats for shooting people, not with characters. Fair point. What problem is that? Bro, it's the reverse-engineering problem. No, it's overengineering. Whatever. But it's something we can record now and have for the future.


00:29:58

For the start we don't need it yet. No, not — I I didn't didn't say say that that. Those are just my explanations for the future, that not every user should have every animation from the start, but that it should be triggered by specific moments or events like MRR or token usage


00:30:13

triggered, so that it then in turn comes. Yeah, okay. Look, if it's really — if it's really business value, what it offers, then okay, you can build it in, along the lines of,


00:30:22

it gets unlocked, then it's — let's say, let's assume we are a million community members. 5 million. Okay, that would be totally massive branding, if you also see your characters online, that not everyone can e.g. suddenly decide,


00:30:41

I have the very — exactly. There is — exactly, that's exactly what it's about. Yeah, okay. In the future, sure, in the future.


00:30:47

Future. Yeah, exactly. And we're totally brainstorming here right now, that's why I want to have this defined. So my goal was to finish the first sprint now.


00:30:56

Finish. Yeah. Yeah. Yeah. And for example uh when these animations have already been unlocked, bro, then the randomness can arise in there anyway.


00:31:06

Come here. Input, input, input, input, input. How about that? What does "or music" mean?


Session ended after 00:31:13

00:31:23

definitely has to be done again, but we have to define levels once. What I said is levels, so from 16 he levels up to this one, right?


00:31:32

Until then he's a baby. 16 to 32 — you can't make small intermediate levels where just the sprite animation gets made bigger. Complex. Yeah, but bro, like with Pokémon — it means the baby does get bigger, but the baby stays the same character. You get it? It stays small, it stays the same animation, it just grows from level to level.


00:31:54

Simply — no complexity, just scaling per level. Minimal — you could do it, but bro, in the end I want to have a beaver like that. I don't. This beaver, he should box against the screen. Bam bam and then you see the screen break and then an AI Beavers sign comes out. No. Yeah, I understand.


00:32:15

But it's supposed to be more like that and not in your face the whole time, because this is good, this is already uh — it's still good, I think. Bro, when you donate to AI Beavers, he gets really big — actually, can you push him aside at any time in case he's annoying right now? No, that — well, yes, you can do it like this. Hey, what's that?


00:32:42

Well, for me that would be important, because sometimes you want to click exactly where he is right now. That's annoying — look, he's upgraded and that doesn't work anymore. No, the overlay isn't working right now. Three times you have to kick. I missed one. M. Yeah, three times.
