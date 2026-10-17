import "../styles/filters.css";
import React, { useRef, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import EditorialHeading from "./EditorialHeading";
import diffuserImage from "../assets/lorisdiffusers.jpg";
import frequencesImage from "../assets/lorisfrequence.png";
import nicheImage from "../assets/lorisniche.jpeg";
import bodyCareImage from "../assets/lorisbodycare.webp";
import perfumeImage from "../assets/lorisperfume.jpg";
import cologneImage from "../assets/loriscologne.jpg";
import autoPerfumeImage from "../assets/lorisaautoperfume.jpg";
import ladiesImage from "../assets/womanperfume.jpeg";
import menImage from "../assets/manperfume.jpeg";

// Sample categories
const categories = [
  { id: 1, name: "Women", image: ladiesImage },
  { id: 2, name: "Men", image: menImage },
  { id: 3, name: "Diffusers", image: diffuserImage },
  { id: 4, name: "Frequence", image: frequencesImage },
  { id: 5, name: "Niche", image: nicheImage },
  { id: 6, name: "Body Care", image: bodyCareImage },
  { id: 7, name: "Auto Perfumes", image: autoPerfumeImage },
  { id: 8, name: "Loris Perfumes", image: perfumeImage },
  { id: 9, name: "Cologne", image: cologneImage },
];

const Filters = () => {
  const scrollRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial filter values from URL or use defaults
  const [minPrice, setMinPrice] = useState(() => {
    const urlMinPrice = searchParams.get("min_price");
    return urlMinPrice ? parseInt(urlMinPrice) : 0;
  });
  
  const [maxPrice, setMaxPrice] = useState(() => {
    const urlMaxPrice = searchParams.get("max_price");
    return urlMaxPrice ? parseInt(urlMaxPrice) : 30000;
  });
  
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return searchParams.get("category") || "";
  });
  
  const [sortBy, setSortBy] = useState(() => {
    return searchParams.get("sort") || "newest";
  });

  // Function to update URL parameters
  const updateUrlParams = () => {
    const params = {};
    
    // Only add parameters that have values
    if (minPrice > 0) params.min_price = minPrice;
    if (maxPrice < 30000) params.max_price = maxPrice;
    if (selectedCategory) params.category = selectedCategory;
    if (sortBy !== "newest") params.sort = sortBy;
    
    // Update URL without causing a page reload
    setSearchParams(params);
  };

  // Update URL when filters change
  useEffect(() => {
    // Add a small delay to avoid too many URL updates when typing
    const timer = setTimeout(() => {
      updateUrlParams();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [minPrice, maxPrice, selectedCategory, sortBy]);

  // Function to scroll left or right by fixed pixels
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
      scrollRef.current.scrollTo({
        left: scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };
  
  // Handle category selection
  const handleCategoryClick = (categoryName) => {
    setSelectedCategory(prev => prev === categoryName ? "" : categoryName);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setMinPrice(0);
    setMaxPrice(30000);
    setSelectedCategory("");
    setSortBy("newest");
  };

  return (
    <div className="filters-section">
      <div className="category-section">
        <EditorialHeading className="section-title">
          Browse Categories
        </EditorialHeading>
        <button className="nav-arrow left" onClick={() => scroll("left")}>
          {"<"}
        </button>
        <div className="slider-wrapper">
          <div className="category-slider" ref={scrollRef}>
            {categories.map((cat) => (
              <div 
                className={`category-card ${selectedCategory === cat.name ? 'selected' : ''}`}
                key={cat.id}
                onClick={() => handleCategoryClick(cat.name)}
              >
                <img src={cat.image} alt={cat.name} className="category-img" />
                <p className="category-text">{cat.name}</p>
              </div>
            ))}
          </div>
        </div>
        <button className="nav-arrow right" onClick={() => scroll("right")}>
          {">"}
        </button>
      </div>
      <div className="filter-price-container">
        <div className="price--container">
          Filter by Price
          <div className="price-range-slider">
            <input
              className="price-filter"
              type="range"
              min="0"
              max="30000"
              value={minPrice}
              onChange={(e) => setMinPrice(parseInt(e.target.value))}
            />
            <input
              className="price-filter"
              type="range"
              min="0"
              max="30000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseInt(e.target.value))}
            />
          </div>
          <div className="price-range-labels">
            <span>KSh 0</span>
            <span>KSh 30,000</span>
          </div>
        </div>
        <div className="sort-dropdown">
          <button className="dropbtn">Sort by: {sortBy.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</button>
          <div className="dropdown-content">
            <button type="button" onClick={() => setSortBy("price-high-to-low")}>Price: High to Low</button>
            <button type="button" onClick={() => setSortBy("price-low-to-high")}>Price: Low to High</button>
            <button type="button" onClick={() => setSortBy("newest")}>Newest Arrivals</button>
          </div>
        </div>
      </div>
      {selectedCategory && (
        <div className="active-filters">
          <span className="filter-tag">
            {selectedCategory}
            <button onClick={() => setSelectedCategory("")}>×</button>
          </span>
        </div>
      )}
      {(selectedCategory || minPrice > 0 || maxPrice < 30000 || sortBy !== "newest") && (
        <button className="clear-all-filters" onClick={clearAllFilters}>
          Clear All Filters
        </button>
      )}
    </div>
  );
};

export default Filters;
