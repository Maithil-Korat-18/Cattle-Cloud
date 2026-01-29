
        function openModal(modalId) {
            document.getElementById(modalId).classList.add('show');
            const today = new Date().toISOString().split('T')[0];
            document.querySelectorAll('input[type="date"]').forEach(input => {
                if (!input.value) input.value = today;
            });
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }

        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.classList.remove('show');
            }
        }

        function submitMilk(event) {
    event.preventDefault();
    
    const data = {
        date: document.getElementById('milkDate').value,
        cow_name: document.getElementById('milkCow').value,
        milk_liters: document.getElementById('milkQuantity').value,
        rate: document.getElementById('milkRate').value
    };

    fetch('/add-milk', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showSuccess(result.message);
            closeModal('milkModal');
            setTimeout(() => location.reload(), 1500);
        } else {
            showSuccess('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showSuccess('Error adding milk record');
    });
}

   function submitExpense(event) {
    event.preventDefault();
    
    const data = {
        date: document.getElementById('expenseDate').value,
        type: document.getElementById('expenseType').value,
        amount: document.getElementById('expenseAmount').value
    };

    fetch('/add-expense', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showSuccess(result.message);
            closeModal('expenseModal');
            setTimeout(() => location.reload(), 1500);
        } else {
            showSuccess('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showSuccess('Error adding expense');
    });
}


      function submitCattle(event) {
    event.preventDefault();
    
    const data = {
        name: document.getElementById('cattleName').value,
        breed: document.getElementById('cattleBreed').value,
        age: document.getElementById('cattleAge').value,
        health: document.getElementById('cattleHealth').value
    };

    fetch('/add-cattle', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showSuccess(result.message);
            closeModal('cattleModal');
            setTimeout(() => location.reload(), 1500);
        } else {
            showSuccess('Error: ' + result.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showSuccess('Error adding cattle');
    });
}
        function showSuccess(message) {
            const msgDiv = document.getElementById('successMessage');
            msgDiv.textContent = message;
            msgDiv.classList.add('show');
            setTimeout(() => msgDiv.classList.remove('show'), 3000);
        }
