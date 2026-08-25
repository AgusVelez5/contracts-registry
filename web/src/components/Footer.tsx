import CopyableText from "./ui/CopyableText";
import { GitHubIcon, LinkedInIcon } from "./ui/icons";
import styles from "./Footer.module.css";

const GITHUB_URL = "https://github.com/AgusVelez5";
const LINKEDIN_URL = "https://www.linkedin.com/in/agustin-velez/";
const DONATION_ADDRESS = "0x91A1F7ea46FeAB0E955A12f5161E53c63f025725";

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.left}>
        <span>Built by Agustín Velez</span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" title="GitHub" className={styles.iconLink}>
          <GitHubIcon />
        </a>
        <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" title="LinkedIn" className={styles.iconLink}>
          <LinkedInIcon />
        </a>
      </div>

      <div className={styles.right}>
        <span className={styles.donateLabel}>Support this project</span>
        <CopyableText value={DONATION_ADDRESS} />
      </div>
    </footer>
  );
}

export default Footer;