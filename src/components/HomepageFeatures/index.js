import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Permissionless',
    Svg: require('@site/static/img/lock-small.svg').default,
    description: (
      <>
        Kommodo protocol is fully permissionless. Anyone can borrow and lend agains any token.
      </>
    ),
  },
    {
      title: 'No oracles',
    Svg: require('@site/static/img/crystal_ball-small.svg').default,
    description: (
      <>
        Kommodo protocol is decentralized and does not rely on any external oracle.
      </>
    ),
  },
  {
    title: 'No bad debt',
    Svg: require('@site/static/img/contract-small.svg').default,
    description: (
      <>
        Solvency is guaranteed through the bonding curve. Removing the need for liquidations of insolvent positions.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
