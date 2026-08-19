//loads all pokemon names for searching
let allPokemonNames = [];
let highlightedIndex = -1;
async function loadAllPokemonNames() {
  const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=100000"); //fetches every single pokemon
  const data = await response.json();                                             //stores it as an array of strings
  allPokemonNames = data.results.map(t => ({displayName:reverseTransformName(t.name), api:t.name})); //stores it as an array with objects
}

loadAllPokemonNames(); //runs the function above
//changes the pokemons name to the media versions eg: api shows "charizard-mega-x" -> mega charizard x
function reverseTransformName(apiName){
  let displayName = apiName.replace(/-/g, " ")
  .replace(/(\w+) (mega|alola|galar|hisui|paldea|primal|gmax)/, "$2 $1") 
  .replace("alola", "alolan")
  .replace("galar", "galarian")
  .replace("hisui", "hisuian")
  .replace("paldea", "paldean")
  return displayName;
}

const pokemonCache = {};

//function for the dropdown in the search bar
async function updateDropdown(input) {
  const dropdown = document.getElementById("search-dropdown");//grabs whats in the search bar

  if (!input){//if empty everything stops
    dropdown.classList.remove("active");
    dropdown.innerHTML = "";
    return;
  }

  dropdown.classList.add("active");

  const query = input.toLowerCase().trim(); //trims whats in the search bar
  const nameMatches = allPokemonNames.filter(p => p.displayName.includes(query)).slice(0, 7); 
//takes the first 20 pokemon that finishes the searched words
  if (nameMatches.length === 0) {
    dropdown.replaceChildren();
    dropdown.innerHTML = "<p style='padding: 8px 10px;'>No Pokémon found</p>";
    return;
  }
  const fragment = document.createDocumentFragment();

  for (const pokemon of nameMatches){
    const item = document.createElement("div");
    item.className = "dropdown-item";
    //item.innerHTML = `<span class="dropdown-item-name">${pokemon.displayName}</span>`;
    item.onclick = function() {
      window.location.href = "pokemoninfo.html?pokemon=" + pokemon.api;
    }
    fragment.appendChild(item); 
    if (pokemonCache[pokemon.api]) {
      item.innerHTML = `
      <img src="${pokemonCache[pokemon.api].spriteCache}"/>
      <span class="dropdown-item-name">${pokemon.displayName}</span>
      ${pokemonCache[pokemon.api].typeCache.map(t => `<span class="type-dropdown type-${t}">${t}</span>`).join("")}
      `;
    }
    else {
      fetch("https://pokeapi.co/api/v2/pokemon/" + pokemon.api)
    .then(res => res.json())
    .then(data => {
      pokemonCache[pokemon.api] = {
        spriteCache: data.sprites.front_default,
        typeCache: data.types.map(t => t.type.name)
      }
      item.innerHTML = `
      <img src="${pokemonCache[pokemon.api].spriteCache}"/>
      <span class="dropdown-item-name">${pokemon.displayName}</span>
      ${pokemonCache[pokemon.api].typeCache.map(t => `<span class="type-dropdown type-${t}">${t}</span>`).join("")}
      `});
  }
}
  dropdown.replaceChildren(fragment);
}                                       


let isSearching = false;
//searching function to find the pokemon and sends user to pokemon info page
async function pokeSearch() {

  if (isSearching){//if the function is already running then this stops a second instance
  return;
}
isSearching = true;
const pokeName = document.getElementById("searchbarid").value.toLowerCase().trim();//takes the value in the search bar

if (!pokeName) {//if empty it stops
isSearching = false;
return;
}

const match = allPokemonNames.find(p => p.displayName.includes(pokeName));//if its in the array of pokemon names then it runs true

if(!match){
  window.location.href = "notfound.html?pokemon=" + pokeName;//if doesnt work then brings it to the not found page
  isSearching = false;
  return;
}
const finalName = match.api;
//^if exact match is true then the final name is the input, if false then it searches for the first instance of the name
try {
  const response = await fetch(//fetches the pokemon info
    "https://pokeapi.co/api/v2/pokemon/" + finalName,
  );
  if (response.ok) {
    window.location.href = "pokemoninfo.html?pokemon=" + finalName;//if it is there then it brings it to the page
  }
  } 
catch (error) {
  alert("Check your connection and try again");//internet catch
  isSearching = false;
}
  isSearching = false;
}

// event listeners for search bar
//DOMContentLoaded so these functions only work once all the html is loaded
document.addEventListener("DOMContentLoaded", function() {
  document //makes it so u can press enter to search not just button
    .getElementById("searchbarid")
    .addEventListener("keydown", function (e) {
      const items = document.querySelectorAll("#search-dropdown .dropdown-item");
      
      if ((e.key === "Tab" && !e.shiftKey) || e.key === "ArrowDown" || e.key === "ArrowRight"){
        e.preventDefault()
        if (items.length === 0){
          return;
        }
        highlightedIndex = (highlightedIndex + 1) % items.length;
      }
      if ((e.key === "Tab" && e.shiftKey)  || e.key === "ArrowUp" || e.key === "ArrowLeft"){
        e.preventDefault()
        if (items.length === 0){
          return;
        }
          highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
      }
      if (e.key === "Enter"){
        if (items.length === 0){
          pokeSearch();
          return;
        }
        if (highlightedIndex >= 0 && items[highlightedIndex]){
          items[highlightedIndex].click();
        }
        else{
          items[0].click();
        }
      }
        items.forEach(i => i.classList.remove("highlighted"));
        if (items[highlightedIndex]) {
          items[highlightedIndex].classList.add("highlighted");
        }
    });

  
  document.addEventListener("keydown", function (e) {
    if (e.key === "/") {//so u can press "/" to open search bar like google
      e.preventDefault();
      document.getElementById("searchbarid").focus();
    }
  });
  //for the dropdown searching event listener input
  document.getElementById("searchbarid").addEventListener("input", function(){
    updateDropdown(document.getElementById("searchbarid").value);
    highlightedIndex = -1;
  });
  //if mouse focused on search bar show dropdown
  document.getElementById("searchbarid").addEventListener("focus", function() {
    if (this.value) {
      document.getElementById("search-dropdown").classList.add("active");
    }
  });
  //if mouse not focused on searchbar then hide dropdown
  document.getElementById("searchbarid").addEventListener("blur", function() {
    setTimeout(() => {
      document.getElementById("search-dropdown").classList.remove("active");
    }, 150);

});
});
