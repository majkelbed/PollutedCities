window.onload = () => {
  const display = document.getElementById("display");
  const autocomplete = document.getElementById("autocomplete");

  const countryInput = document.getElementById("form_input--country");
  countryInput.value =
    sessionStorage.inputValue !== undefined ? sessionStorage.inputValue : "";

  const form = document.getElementById("form");

  const countryNames = [];
  const validCountries = ["Poland", "Germany", "Spain", "France"];

  const fetchCountryNames = async () => {
    const countries = await fetch("https://api.openaq.org/v1/countries")
      .then(res => res.json())
      .catch(error => console.log(error.message));
    const names = countries.results
      .map(country => {
        return { name: country.name, code: country.code };
      })
      .filter(country => country.name != undefined);
    countryNames.push(...names);
  };

  fetchCountryNames();

  const findMatches = e => {
    const regex = new RegExp(e.target.value, "gi");
    const results = countryNames
      .filter(country => country.name.match(regex))
      .map(country => country.name);
    if (e.target.value.length > 0) {
      displayMatches(results);
    } else {
      displayMatches([]);
    }
  };

  const fetchMostPolutedCities = async input => {
    const { name, code } = countryNames.find(country => country.name === input);
    if (localStorage.getItem(name) == null) {
      var url = `https://api.openaq.org/v1/measurements?country=${code}&parameter=pm25&order_by=value&sort=desc&limit=10000&value_from=10&date_from=2019-01-01`;

      var urlCities = `https://api.openaq.org/v1/cities?country=${code}&limit=1000`;
      const cities = await fetch(urlCities)
        .then(res => res.json())
        .then(obj => obj.results)
        .catch(error => console.log(error.message));
      const cityNames = cities.map(city => city.city);

      const promises = cityNames.map(city =>
        fetch(url + `&city=${city}`).then(res => res.json())
      );
      const measurements = await Promise.all(promises).catch(error =>
        console.log(error.message)
      );
      const results = measurements
        .filter(locMeasures => locMeasures.results.length > 0)
        .map(location => {
          const l = location.results;
          const sum = l.reduce((acc, obj) => acc + +obj.value, 0);
          const avg = sum / l.length;
          return { city: l[0].city, avg };
        })
        .sort((a, b) => (a.avg < b.avg ? 1 : -1))
        .splice(0, 10);
      localStorage.setItem(name, JSON.stringify(results));
      console.log(results);
      return results;
    } else return JSON.parse(localStorage.getItem(name));
  };

  const displayMatches = matches => {
    const html = matches.reduce(
      (html, match) =>
        html + `<li onmousedown="handleAutocomplete(event)">${match}</li>`,
      ""
    );

    autocomplete.innerHTML = html;
  };

  const modInput = input => {
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  };

  const isValidInput = async e => {
    e.preventDefault();
    autocomplete.innerHTML = "";
    const currentVal = document.getElementById("form_input--country").value;
    const input = modInput(currentVal);
    if (validCountries.includes(input)) {
      display.innerHTML = `loading data...`;
      autocomplete.innerHTML = "";
      const cities = await fetchMostPolutedCities(input);
      display.innerHTML = cities.reduce(
        (html, location) =>
          html +
          `<li data-city="${location.city}" class="countryForm_display--item">
            <div class="countryForm_display--city">
              <div class="countryForm_display--description">
                <h3>${location.city}</h3>
                <p>${location.avg.toFixed(2)} pm2.5</p>
              </div>
              <button class="countryForm_display--toggle" onclick="handleDescription(event)"></button>
            </div>
            <div class="countryForm_display--detailedDescription"></div>
          </li>`,
        ""
      );
    } else {
      countryInput.classList.add("animated", "shake");
      countryInput.style.borderColor = "red";
      display.innerHTML = `Valid countries to search ${validCountries}`;
    }
  };

  countryInput.addEventListener("input", findMatches);
  countryInput.addEventListener("focus", findMatches);
  countryInput.addEventListener("blur", e => {
    autocomplete.innerHTML = "";
    sessionStorage.inputValue = countryInput.value;
  });

  countryInput.addEventListener("animationend", e => {
    e.target.classList.remove("animated", "shake");
    countryInput.style.borderColor = "beige";
  });

  form.addEventListener("submit", isValidInput);
};

const handleDescription = async e => {
  e.preventDefault();
  const parent = e.target.parentElement.parentElement;
  const cityName = parent.dataset.city;
  const target = [...parent.children].find(
    child => child.className === "countryForm_display--detailedDescription"
  );
  if (target.style.display !== "block") {
    e.target.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    target.innerHTML = "loading...";
    target.style.display = "block";
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&titles=";
    const result = await fetch(url + cityName)
      .then(res => res.json())
      .catch(error => console.log(error.message));
    const description = Object.values(result.query.pages)[0].extract;
    if (description === "" || description == undefined)
      target.innerHTML = "Sorry, found nothing :(";
    else target.innerHTML = description;
  } else {
    e.target.style.clipPath = "polygon(0 0, 50% 100%, 100% 0)";
    target.style.display = "none";
    target.innerHTML = "";
  }
};

const handleAutocomplete = e => {
  const countryInput = document.getElementById("form_input--country");
  countryInput.value = e.target.innerHTML;
};
