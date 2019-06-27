window.onload = () => {
  const display = document.getElementById("display");
  const autocomplete = document.getElementById("autocomplete");
  const countryInput = document.getElementById("form_input--country");
  const form = document.getElementById("form");
  const countryNames = [];
  const validCountries = ["Poland", "Germany", "Spain", "France"];

  const populateCountryNames = async () => {
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

  const fetchMostPollutedCities = async input => {
    const { name, code } = countryNames.find(country => country.name === input);
    if (localStorage.getItem(name) == null) {
      const url = `https://api.openaq.org/v1/measurements?country=${code}&parameter=pm25&order_by=value&sort=desc&limit=10000&value_from=10&date_from=2019-01-01`;

      const urlCities = `https://api.openaq.org/v1/cities?country=${code}&limit=1000`;
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
      return results;
    } else return JSON.parse(localStorage.getItem(name));
  };

  const displayMatches = matches => {
    const html = matches.reduce(
      (html, match) =>
        html +
        `<li tabindex="0" onmousedown="handleAutocomplete(event)">${match}</li>`,
      ""
    );

    autocomplete.innerHTML = html;
  };

  const modInput = input => {
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
  };

  const displayCities = async e => {
    e.preventDefault();
    autocomplete.innerHTML = "";
    const currentVal = document.getElementById("form_input--country").value;
    const input = modInput(currentVal);
    if (validCountries.includes(input)) {
      display.innerHTML = `loading data...`;
      autocomplete.innerHTML = "";
      const cities = await fetchMostPollutedCities(input);
      display.innerHTML = cities.reduce(
        (html, location) =>
          html +
          `<li tabindex="0" data-city="${
            location.city
          }" class="countryForm_display--item">
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

  const handleKeyboardNavigation = e => {
    const clean = () => {
      autocomplete.innerHTML = "";
    };
    e.preventDefault();
    if (e.keyCode === 40) {
      //arrow down
      const next = e.target.nextSibling;
      next != null ? next.focus() : "";
    } else if (e.keyCode === 38) {
      //arrow up
      const prev = e.target.previousSibling;
      if (prev != null) prev.focus();
      else {
        countryInput.focus();
        clean();
      }
    } else if (e.keyCode === 13) {
      //enter
      handleAutocomplete(e);
    } else {
      clean();
    }
  };

  const handleKeyboardNavigationInputFocus = e => {
    if (e.keyCode === 40) {
      e.preventDefault;
      const child = autocomplete.firstChild;
      child != null ? child.focus() : findMatches(e);
    }
  };

  countryInput.value =
    sessionStorage.inputValue !== undefined ? sessionStorage.inputValue : "";

  populateCountryNames();

  form.addEventListener("submit", displayCities);

  countryInput.addEventListener("input", findMatches);
  countryInput.addEventListener("focus", findMatches);
  countryInput.addEventListener("blur", e => {
    if (e.relatedTarget == null) autocomplete.innerHTML = "";
  });
  countryInput.addEventListener("keyup", handleKeyboardNavigationInputFocus);
  countryInput.addEventListener("animationend", e => {
    e.target.classList.remove("animated", "shake");
    countryInput.style.borderColor = "beige";
  });

  autocomplete.addEventListener("keydown", handleKeyboardNavigation);

  window.addEventListener("mouseup", e => {
    if (e.target !== countryInput) autocomplete.innerHTML = "";
  });
  window.addEventListener(
    "unload",
    () => (sessionStorage.inputValue = countryInput.value)
  );
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
  const autocomplete = document.getElementById("autocomplete");
  countryInput.value = e.target.innerHTML;
  autocomplete.innerHTML = "";
};
