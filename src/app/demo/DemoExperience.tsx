"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  CarFront,
  Check,
  Clock3,
  MapPin,
  Navigation,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import styles from "./demo.module.css";

type RideChoice = "shared" | "private";

const steps = [
  {
    number: "01",
    icon: MapPin,
    title: "Set the journey",
    description:
      "Choose pickup and drop-off points, then tell Commuter when you need to arrive.",
  },
  {
    number: "02",
    icon: CarFront,
    title: "Choose your ride",
    description:
      "Compare private and shared ride options, with the trip details clear before you confirm.",
  },
  {
    number: "03",
    icon: Navigation,
    title: "Follow the trip",
    description:
      "Keep up with trip status and the pickup-to-drop-off journey in one place.",
  },
];

const benefits = [
  {
    icon: UsersRound,
    title: "Shared or private",
    description:
      "Give commuters a choice of ride types and vehicle options to suit different journeys.",
  },
  {
    icon: Clock3,
    title: "Arrival-led planning",
    description:
      "Plan around the time people need to arrive, with pickup timing calculated for the route.",
  },
  {
    icon: ShieldCheck,
    title: "A clearer trip experience",
    description:
      "Keep route details, trip updates, and driver coordination together from booking to arrival.",
  },
];

export default function DemoExperience() {
  const [rideChoice, setRideChoice] = useState<RideChoice>("shared");
  const shouldReduceMotion = useReducedMotion();
  const entrance = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.18 },
        transition: { duration: 0.28, ease: "easeOut" as const },
      };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="Commuter home">
            <Image
              src="/assets/images/commuterLogo.png"
              alt=""
              width={38}
              height={38}
              priority
            />
            <span>commuter</span>
          </Link>
          <nav className={styles.navigation} aria-label="Main navigation">
            <a href="#experience">The experience</a>
            <a href="#how-it-works">How it works</a>
            <a href="#for-teams">Mobility value</a>
          </nav>
          <Link className={styles.signIn} href="/login?redirect=%2Fcreate">
            Sign in
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroInner}>
            <motion.div
              className={styles.heroCopy}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <p className={styles.eyebrow}>CONCEPT DEMO · ABU DHABI</p>
              <h1 id="hero-heading">
                A clearer journey,
                <span> from pickup to arrival.</span>
              </h1>
              <p className={styles.heroDescription}>
                Commuter brings trip planning, private and shared ride choices,
                and journey updates into one simple experience. This concept
                uses Abu Dhabi as its setting; routes and availability are
                illustrative and subject to operational review.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#experience">
                  Explore the demo
                  <ArrowDown size={17} aria-hidden="true" />
                </a>
                <a className={styles.textLink} href="#how-it-works">
                  See how it works
                </a>
              </div>
              <p className={styles.heroNote}>
                Prepared for discussion with Abu Dhabi Department of Transport.
                This is not an official DoT service or endorsement.
              </p>
            </motion.div>

            <motion.div
              className={styles.previewWrap}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: shouldReduceMotion ? 0 : 0.06, ease: "easeOut" }}
            >
              <div className={styles.previewCard} id="experience">
                <div className={styles.previewHeader}>
                  <div>
                    <p className={styles.previewKicker}>A COMMUTER PREVIEW</p>
                    <h2>A trip, at a glance</h2>
                  </div>
                  <span className={styles.previewStatus}>
                    <span aria-hidden="true" />
                    Sample
                  </span>
                </div>

                <div
                  className={styles.mapPreview}
                  role="img"
                  aria-label="Illustrative route from Al Reem Island to Corniche Road"
                >
                  <div className={styles.mapRoads} aria-hidden="true">
                    <span className={styles.roadOne} />
                    <span className={styles.roadTwo} />
                    <span className={styles.roadThree} />
                    <span className={styles.roadFour} />
                    <svg viewBox="0 0 540 240" preserveAspectRatio="none">
                      <path
                        className={styles.routeShadow}
                        d="M92 174 C143 168 139 93 214 106 S299 168 347 121 S407 67 456 72"
                      />
                      <path
                        className={styles.routeLine}
                        d="M92 174 C143 168 139 93 214 106 S299 168 347 121 S407 67 456 72"
                      />
                    </svg>
                  </div>
                  <span className={`${styles.mapPin} ${styles.pickupPin}`} aria-hidden="true">
                    <MapPin size={20} />
                  </span>
                  <span className={`${styles.mapPin} ${styles.dropoffPin}`} aria-hidden="true">
                    <MapPin size={20} />
                  </span>
                  <span className={`${styles.mapLabel} ${styles.pickupLabel}`}>Al Reem Island</span>
                  <span className={`${styles.mapLabel} ${styles.dropoffLabel}`}>Corniche Road</span>
                  <span className={styles.mapCaption}>Illustrative only</span>
                </div>

                <div className={styles.tripDetails}>
                  <div className={styles.routeSummary}>
                    <div className={styles.routeStops} aria-hidden="true">
                      <span className={styles.originDot} />
                      <span className={styles.stopConnector} />
                      <span className={styles.destinationDot} />
                    </div>
                    <div className={styles.stopNames}>
                      <p>Al Reem Island</p>
                      <p>Corniche Road</p>
                    </div>
                    <span className={styles.tripLabel}>Sample journey</span>
                  </div>

                  <div className={styles.choiceBlock}>
                    <p className={styles.choiceLabel}>Choose a ride style</p>
                    <div className={styles.choiceGroup} role="group" aria-label="Sample ride style">
                      <button
                        type="button"
                        className={rideChoice === "shared" ? styles.choiceActive : styles.choice}
                        aria-pressed={rideChoice === "shared"}
                        onClick={() => setRideChoice("shared")}
                      >
                        <UsersRound size={17} aria-hidden="true" />
                        Shared
                        {rideChoice === "shared" && <Check size={16} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className={rideChoice === "private" ? styles.choiceActive : styles.choice}
                        aria-pressed={rideChoice === "private"}
                        onClick={() => setRideChoice("private")}
                      >
                        <CarFront size={17} aria-hidden="true" />
                        Private
                        {rideChoice === "private" && <Check size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <p className={styles.demoDisclaimer}>
                    {rideChoice === "shared"
                      ? "Shared ride selected · vehicle and fare options appear when booking."
                      : "Private ride selected · vehicle and fare options appear when booking."}
                  </p>
                </div>
              </div>
              <div className={styles.floatingNote}>
                <span className={styles.floatingIcon}>
                  <Clock3 size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Plan for arrival</strong>
                  <small>Pickup time adapts to the route</small>
                </span>
              </div>
            </motion.div>
          </div>
          <div className={styles.heroGlow} aria-hidden="true" />
        </section>

        <section className={styles.stepsSection} id="how-it-works" aria-labelledby="steps-heading">
          <motion.div className={styles.sectionHeading} {...entrance}>
            <p className={styles.sectionEyebrow}>A straightforward flow</p>
            <h2 id="steps-heading">From plan to pickup, without the guesswork.</h2>
            <p>
              Commuter keeps the important decisions visible, so each traveler
              knows what comes next.
            </p>
          </motion.div>
          <div className={styles.stepsGrid}>
            {steps.map(({ number, icon: Icon, title, description }, index) => (
              <motion.article
                className={styles.stepCard}
                key={number}
                {...(shouldReduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 14 },
                      whileInView: { opacity: 1, y: 0 },
                      viewport: { once: true, amount: 0.2 },
                      transition: { duration: 0.26, delay: index * 0.04, ease: "easeOut" as const },
                    })}
              >
                <div className={styles.stepTop}>
                  <span>{number}</span>
                  <Icon size={21} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.teamSection} id="for-teams" aria-labelledby="team-heading">
          <motion.div className={styles.teamIntro} {...entrance}>
            <p className={styles.sectionEyebrow}>Mobility for everyday journeys</p>
            <h2 id="team-heading">A ride experience people can understand at a glance.</h2>
            <p>
              A traveler can set a destination and arrival time, choose a
              private or shared ride, and keep trip details together in one
              familiar flow.
            </p>
            <Link className={styles.teamLink} href="/login?redirect=%2Fcreate">
              Try Commuter
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </motion.div>
          <div className={styles.benefitList}>
            {benefits.map(({ icon: Icon, title, description }, index) => (
              <motion.article
                className={styles.benefit}
                key={title}
                {...(shouldReduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, x: 12 },
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true, amount: 0.2 },
                      transition: { duration: 0.26, delay: index * 0.04, ease: "easeOut" as const },
                    })}
              >
                <span className={styles.benefitIcon}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </span>
                <Check size={18} className={styles.benefitCheck} aria-hidden="true" />
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.closing}>
          <motion.div className={styles.closingInner} {...entrance}>
            <p className={styles.sectionEyebrow}>An Abu Dhabi concept demo</p>
            <h2>Explore a clearer ride experience for Abu Dhabi.</h2>
            <p>
              Use this demonstration to start a conversation about how
              private and shared ride choices could fit into local journeys.
            </p>
            <Link className={styles.primaryButton} href="/login?redirect=%2Fcreate">
              Open Commuter
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/" aria-label="Commuter home">
          <Image src="/assets/images/commuterLogo.png" alt="" width={30} height={30} />
          <span>commuter</span>
        </Link>
        <p>Private and shared ride choices · Abu Dhabi concept demonstration</p>
      </footer>
    </div>
  );
}
