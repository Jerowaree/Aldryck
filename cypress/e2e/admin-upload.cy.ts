const getEnv = (key: string) => {
  const value = Cypress.env(key);
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required Cypress env: ${key}`);
  }
  return value;
};

const getOptionValues = ($options: JQuery<HTMLOptionElement>) =>
  Array.from($options, (option) => option.value);

const loginAsAdmin = () => {
  const email = getEnv("ADMIN_EMAIL");
  const password = getEnv("ADMIN_PASSWORD");

  cy.visit("/admin-login");
  cy.get("#admin-email").clear().type(email);
  cy.get("#admin-password").type(password, { log: false });
  cy.get("#admin-login-submit").click();
  cy.url().should("include", "/admin");
};

const ensureCategorySelected = () => {
  cy.get("#category-select").should("be.visible");
  cy.get<HTMLOptionElement>("#category-select option").then(($options) => {
    const values = getOptionValues($options);
    const existing = values.find((value) => value);

    if (existing) {
      cy.get("#category-select").select(existing);
      return;
    }

    const name = `Cypress ${Date.now()}`;
    cy.get('#category-form input[name="name"]').type(name);
    cy.get("#category-form").submit();
    cy.contains("#admin-status", "creada").should("exist");
    cy.get<HTMLOptionElement>("#category-select option").then(($newOptions) => {
      const updatedValues = getOptionValues($newOptions);
      const createdValue = updatedValues.find((value) => value);
      if (!createdValue) {
        throw new Error("No category options available after creation.");
      }
      cy.get("#category-select").select(createdValue);
    });
  });
};

const fileInput = '#photo-form input[name="file"]';
const typeErrorMessage =
  "Error: Solo se permiten imagenes JPG, PNG, WebP o AVIF.";

const acceptedCases = [
  {
    name: "accepts WebP from mobile camera/export flows",
    fileName: "mobile-shot.webp",
    mimeType: "image/webp",
  },
  {
    name: "accepts AVIF from desktop export flows",
    fileName: "desktop-export.avif",
    mimeType: "image/avif",
  },
  {
    name: "accepts JPEG with permissive browser mime aliases",
    fileName: "legacy-camera.jpg",
    mimeType: "image/pjpeg",
  },
  {
    name: "accepts PNG with permissive browser mime aliases",
    fileName: "legacy-editor.png",
    mimeType: "image/x-png",
  },
];

const rejectedCases = [
  {
    name: "blocks HEIC because it is not a safe web delivery format yet",
    fileName: "iphone.heic",
    mimeType: "image/heic",
  },
  {
    name: "blocks PDF uploads",
    fileName: "document.pdf",
    mimeType: "application/pdf",
  },
];

const assertAcceptedUpload = (fileName: string, mimeType: string) => {
  cy.intercept("POST", "/api/upload-photo.json", {
    statusCode: 201,
    body: { data: { id: "test-upload" } },
  }).as("upload");
  cy.intercept("GET", "/api/admin-photos.json", {
    statusCode: 200,
    body: { data: [] },
  }).as("photos");

  cy.get('#photo-form input[name="title"]').clear().type("Cypress test");
  cy.get(fileInput).selectFile({
    contents: Cypress.Buffer.from("fake"),
    fileName,
    mimeType,
  });

  cy.get("#photo-form").submit();
  cy.wait("@upload");
  cy.wait("@photos");
  cy.contains("#admin-status", "Foto subida").should("be.visible");
};

const assertRejectedUpload = (fileName: string, mimeType: string) => {
  let uploadCalls = 0;
  cy.intercept("POST", "/api/upload-photo.json", () => {
    uploadCalls += 1;
  }).as("upload");

  cy.get(fileInput).selectFile({
    contents: Cypress.Buffer.from("fake"),
    fileName,
    mimeType,
  });
  cy.get("#photo-form").submit();
  cy.contains("#admin-status", typeErrorMessage).should("be.visible");
  cy.then(() => {
    expect(uploadCalls).to.equal(0);
  });
};

[
  { name: "mobile", viewport: () => cy.viewport(390, 844) },
  { name: "desktop", viewport: () => cy.viewport(1440, 960) },
].forEach(({ name, viewport }) => {
  describe(`Admin upload validation (${name})`, () => {
    beforeEach(() => {
      viewport();
      loginAsAdmin();
      ensureCategorySelected();
    });

    it("exposes the expanded accept attribute", () => {
      cy.get(fileInput).should(
        "have.attr",
        "accept",
        "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif",
      );
    });

    acceptedCases.forEach(({ name: testName, fileName, mimeType }) => {
      it(testName, () => {
        assertAcceptedUpload(fileName, mimeType);
      });
    });

    rejectedCases.forEach(({ name: testName, fileName, mimeType }) => {
      it(testName, () => {
        assertRejectedUpload(fileName, mimeType);
      });
    });
  });
});
