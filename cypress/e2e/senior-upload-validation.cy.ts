[
  { name: 'Desktop', viewport: [1280, 720] },
  { name: 'Mobile (iPhone XR)', viewport: [414, 896] }
].forEach(({ name, viewport }) => {
  describe(`Suite de Pruebas: Carga de Fotos (${name})`, () => {
    const adminEmail = 'aldryckmedinaseverino@gmail.com';
    const adminPassword = 'Aldryck@2026';

    beforeEach(() => {
      // Set viewport
      cy.viewport(viewport[0], viewport[1]);
      
      // Login flow
      cy.visit('/admin-login');
      cy.get('#admin-email').clear().type(adminEmail);
      cy.get('#admin-password').type(adminPassword);
      cy.get('#admin-login-submit').click();
      cy.url().should('include', '/admin');
      
      // Ensure a category is selected (required for upload)
      cy.get('#category-select').should('not.contain', 'Cargando');
      cy.get('#category-select').then($select => {
        const options = $select.find('option[value!=""]');
        if (options.length === 0) {
          cy.get('#category-form input[name="name"]').clear().type('Test Category');
          cy.get('#category-form').submit();
          cy.get('#category-select').find('option[value!=""]').should('have.length.at.least', 1);
        }
        cy.get('#category-select').select(1); 
      });
    });

    it('Debe permitir subir más de 15 fotos simultáneamente', () => {
      const fileInput = '#photo-form input[name="file"]';
      const files = Array.from({ length: 20 }, (_, i) => ({
        contents: Cypress.Buffer.from('fake-image-content'),
        fileName: `test-photo-${i}.jpg`,
        mimeType: 'image/jpeg',
      }));

      cy.intercept('POST', '/api/upload-photo.json', {
        statusCode: 201,
        body: { data: { success: true } }
      }).as('uploadRequest');

      cy.get(fileInput).selectFile(files);
      cy.get('#photo-form').submit();

      cy.wait('@uploadRequest');
      cy.contains('éxito').should('be.visible');
    });

    it('Debe permitir archivos de gran tamaño (>10MB)', () => {
      const fileInput = '#photo-form input[name="file"]';
      const largeFile = {
        contents: Cypress.Buffer.from('a'.repeat(11 * 1024 * 1024)), // 11MB
        fileName: 'large-photo.jpg',
        mimeType: 'image/jpeg',
      };

      cy.intercept('POST', '/api/upload-photo.json', {
        statusCode: 201,
        body: { data: { success: true } }
      }).as('uploadRequest');

      cy.get('#photo-form input[name="title"]').clear().type('Large Photo Test');
      cy.get(fileInput).selectFile(largeFile);
      cy.get('#photo-form').submit();

      cy.wait('@uploadRequest');
      cy.contains('éxito').should('be.visible');
    });

    it('Debe mostrar el Modal de Error premium en caso de fallo del servidor', () => {
      const fileInput = '#photo-form input[name="file"]';
      const errorMessage = 'Error de servidor simulado: Límite de cuota excedido';

      cy.intercept('POST', '/api/upload-photo.json', {
        statusCode: 500,
        body: { error: errorMessage }
      }).as('failedUpload');

      cy.get('#photo-form input[name="title"]').clear().type('Error Test');
      cy.get(fileInput).selectFile({
        contents: Cypress.Buffer.from('fake'),
        fileName: 'error-photo.jpg',
        mimeType: 'image/jpeg',
      });
      
      cy.get('#photo-form').submit();

      cy.wait('@failedUpload');

      // Verify Error Modal Visibility
      cy.get('#error-modal', { timeout: 10000 }).should('be.visible');
      cy.get('#error-modal-message').should('contain.text', errorMessage);
      cy.get('#error-modal h3').should('contain.text', 'Ups, algo salió mal');
      
      // Test closing the modal
      cy.get('#close-error-modal').click();
      cy.get('#error-modal').should('not.be.visible');
    });
  });
});
