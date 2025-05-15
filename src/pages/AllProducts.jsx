import Header from '../components/Header.jsx'
import Filters from '../components/Filters.jsx'
import Grid from '../components/Grid.jsx'
import Footer from '../components/Footer.jsx'
import { Helmet } from 'react-helmet'

function AllProducts() {
  return (
    <>
        <Helmet>
          <title>Loris | All Products</title>
          <meta name="description" content="Explore our wide range of products." />
          <meta name="keywords" content="loris kenya products,loris kenya all products, loris kenya shop" />
          <link rel="canonical" href="https://www.loriskenya.com/all-products" />
          <meta property="og:title" content="All Products" />
          <meta property="og:description" content="Explore our wide range of products." />
          <meta property="og:url" content="https://www.loriskenya.com/all-products" />
        </Helmet>
        <Header />
        <Filters />
        <Grid />
        <Footer />
    </>
  )
}

export default AllProducts