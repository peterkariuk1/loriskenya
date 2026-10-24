import { Link, useLocation, useNavigationType } from "react-router-dom";
import Header from "../components/Header.jsx";
import Banner from "../components/Banner.jsx";
import Categories from "../components/Categories.jsx";
import MensGrid from "../components/MensGrid.jsx";
import BestSellerGrid from "../components/BestSellerGrid.jsx";
import LadiesGrid from "../components/LadiesGrid.jsx";
import Footer from "../components/Footer.jsx";
import { Helmet } from "react-helmet";
import { useStorefrontScrollRestoration } from "../hooks/useStorefrontScrollRestoration";
import { getSectionOrder } from "../utils/personalizationRanking.js";

const Home = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  useStorefrontScrollRestoration(location, navigationType);

  return (
    <>
      <Helmet>
        <title>Loris | Home</title>
        <meta name="description" content="Discover the latest trends and styles at Loris Kenya." />
        <meta name="keywords" content="loris kenya, loris kenya home, loris kenya shop, loris perfume, loris kenya perfume" />
        <link rel="canonical" href="https://www.loriskenya.com/" />
        <meta property="og:title" content="Loris | Home" />
        <meta property="og:description" content="Discover the latest trends and styles at Loris Kenya." />
        <meta property="og:url" content="https://www.loriskenya.com/" />
      </Helmet>
      <div className="home-page">
        <Header />
        <Banner />
        <Categories />
        {getSectionOrder().map((section) => {
          if (section === "bestSellers") return <BestSellerGrid key={section} />;
          if (section === "ladies") return <LadiesGrid key={section} />;
          return <MensGrid key={section} />;
        })}

        <Link to="/all-products">
          <button
            type="button"
            style={{ textDecoration: "none" }}
            className="view-all-button"
          >
            View All Products
          </button>
        </Link>

        <Footer />
      </div>
    </>
  );
};

export default Home;
