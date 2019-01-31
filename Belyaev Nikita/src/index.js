var toDoList = (function() {

    // Tests if local storage is avalible
    function storageAvailable(type) {
        try {
            var storage = window[type],
                x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return e instanceof DOMException && (
                    e.code === 22 ||
                    e.code === 1014 ||
                    e.name === 'QuotaExceededError' ||
                    e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                storage.length !== 0;
        }
    }

    function Deadline(date) {
        this.date = new Date(date);
    }

    Deadline.DAY = {
        ms: 1000 * 60 * 60 * 24
    };

    // Returns ms between date of deadline and now
    Deadline.prototype.msFromNowToDate = function() {
        return this.date - Date.now();
    }
    // Returns days between date of deadline and now
    Deadline.prototype.getDays = function() {
        return Math.ceil(this.msFromNowToDate() / Deadline.DAY.ms);
    }

    Deadline.prototype.toString = function() {
        var isPast = this.getDays() <= 0;
        var days = this.getDays();

        if (days == 0) {
            return 'Today';
        } else {
            return Math.abs(days) + ' ' + (Math.abs(days) == 1 ? 'day' : 'days') + (isPast ? ' ago' : ' left')
        }
    }

    function Task(message, deadline) {
        Task.id = (Task.id || 0) + 1;

        this.id = Task.id;
        this.message = message;
        this.isDone = false;
        this.deadline = deadline ? new Deadline(deadline) : null
    }

    Task.prototype.toggle = function() {
        this.isDone = !this.isDone;
    }
    // Describes a list of items
    function List(view) {
        this.tasks = [];
        this.view = view;
        this.filters = {
            done: 'all',
            deadline: 'all'
        }
        this.loadStateFromLocalStorage();

    }

    List.SORTING_RULES = {
        dateFirst: function(a, b) {
            return a.id - b.id;
        },
        dateLast: function(a, b) {
            return b.id - a.id;
        },
        urgency: function(a, b) {
            if (a.deadline && b.deadline) {
                return a.deadline.date - b.deadline.date;
            }
            if (a.deadline && !b.deadline) {
                return -1;
            }
        }
    }

    List.prototype.saveStateToLocalStorage = function() {
        localStorage.setItem('toDoListState', JSON.stringify({
            tasks: this.tasks,
            id: Task.id
        }));
    }

    List.prototype.loadStateFromLocalStorage = function() {
        var self = this;
        if (storageAvailable) {
            var state = JSON.parse(localStorage.getItem('toDoListState'));
            if (state) {
                state.tasks.forEach(function(element) {
                    var newTask = new Task();

                    if (element['deadline']) {
                        element['deadline'] = new Deadline(element['deadline'].date);
                    }

                    for (var attrname in element) {
                        newTask[attrname] = element[attrname];
                    }

                    self.tasks.push(newTask);
                })
                Task.id = state.id;
            }

            this.view.updateCounter(this.tasks);
            this.view.drawList(this.tasks);
        }
    }

    List.prototype.addTask = function(message, deadline) {
        var newTask = new Task(message, deadline);
        this.tasks.push(newTask);

        this.view.addTask(newTask);
        this.view.updateCounter(this.tasks);
        this.view.filter(this.filters.done, this.filters.deadline);
        this.saveStateToLocalStorage();
    }

    List.prototype.removeTask = function(id) {
        this.tasks = this.tasks.filter(function(task) {
            return task.id != id;
        })

        this.saveStateToLocalStorage();
        this.view.drawList(this.tasks);
        this.view.filter(this.filters.done, this.filters.deadline);
        this.view.updateCounter(this.tasks);
    }

    List.prototype.getTask = function(id) {
        return this.tasks.filter(function(task) {
            return task.id == id;
        })[0];
    }

    List.prototype.toggleTask = function(id) {
        this.getTask(id).toggle();
        this.saveStateToLocalStorage();
        this.view.toggle(id);
        this.view.filter(this.filters.done, this.filters.deadline);
        this.view.updateCounter(this.tasks);
    }

    List.prototype.filterList = function(filter, rule) {
        this.filters[filter] = rule;
        this.view.filter(this.filters.done, this.filters.deadline);
    }

    List.prototype.sort = function(rule) {
        this.tasks.sort(List.SORTING_RULES[rule]);
        this.view.drawList(this.tasks);
        this.view.filter(this.filters.done, this.filters.deadline);
    }

    List.prototype.clearDone = function() {
        this.tasks = this.tasks.filter(function(task) {
            return task.isDone === false;
        });

        this.saveStateToLocalStorage();
        this.view.clearDone();
        this.view.updateCounter(this.tasks);
    }

    List.prototype.clearAll = function() {
        var accept = confirm('Are you sure?');
        if (accept) {
            Task.id = 0;
            this.tasks = [];

            this.saveStateToLocalStorage();
            this.view.clear();
            this.view.updateCounter(this.tasks);
        }

    }

    function View() {
        this.taskList = document.querySelector('.task-list');
        this.filters = document.querySelector('.controls');
        this.form = document.querySelector('.new-task');
        this.formText = this.form.querySelector('.new-task__input--text');
        this.formDate = this.form.querySelector('.new-task__input--deadline');
        this.counterTotal = this.filters.querySelector('.controls__total');
        this.counterDone = this.filters.querySelector('.controls__done');
        this.showMenu = document.querySelector('.header__menu-btn');
    }

    View.prototype.createTaskHTML = function(task) {
        var deadline = task.deadline || ' ';
        var date = task.deadline ? task.deadline.date.toISOString().substring(0, 10) : ' ';

        var deadlineFilter = '';
        if (deadline instanceof Deadline) {
            var days = deadline.getDays();
            if (days >= 0 && days <= 1) {
                deadlineFilter = ' nextDay';
            } else if (days >= 0 && days <= 7) {
                deadlineFilter = ' nextWeek';
            }
        }

        var html = '' +
            '<article tabindex="0" class="task ' + (task.isDone ? 'done' : '') + deadlineFilter + '" data-id="' + task.id + '">' +
            '<p class="task__message">' +
            task.message +
            '</p>' +
            '<div class="task__footer">' +
            '<time datetime="' + date + '">' + deadline + '</time>' +
            '<button class="task__remove">Remove</button>' +
            '</div>' +
            '</article>';
        return html;
    }

    View.prototype.addTask = function(task) {
        this.taskList.insertAdjacentHTML('beforeend', this.createTaskHTML(task));
    }

    View.prototype.clear = function() {
        this.taskList.innerHTML = '';
    }

    View.prototype.drawList = function(tasks) {
        this.taskList.innerHTML = '';
        tasks.map(function(task) {
            this.addTask(task);
        }, this);
    }

    View.prototype.removeTask = function(id) {
        var taskToRemove = this.taskList.querySelector('.task[data-id="' + id + '"]');
        this.taskList.removeChild(taskToRemove);
    }

    View.prototype.toggle = function(id) {
        var task = this.taskList.querySelector('.task[data-id="' + id + '"]');
        task.classList.toggle('done');
    }

    View.prototype.showAll = function() {
        var tasks = this.taskList.querySelectorAll('article.hidden');
        [].forEach.call(tasks, function(element) {
            element.classList.remove('hidden');
        });
    }

    View.prototype.filter = function(done, deadline) {
        this.showAll();
        var query = '';

        switch (done) {
            case 'done':
                query += 'article:not(.done), ';
                break;

            case 'undone':
                query += 'article.done, ';
                break;

            default:
                query += ':not(*), ';
                break;
        }

        switch (deadline) {
            case 'Day':
                query += 'article:not(.nextDay)';
                break;

            case 'Week':
                query += 'article:not(.nextDay):not(.nextWeek)';
                break;

            default:
                query += ' :not(*)';
                break;
        }

        var tasks = query ? this.taskList.querySelectorAll(query) : [];
        [].forEach.call(tasks, function(element) {
            element.classList.add('hidden');
        });
    }

    View.prototype.updateCounter = function(tasks) {
        var total = tasks.length;
        var completed = tasks.filter(function(task) {
            return task.isDone;
        }).length;
        this.counterTotal.innerHTML = total;
        this.counterDone.innerText = completed;

    }

    View.prototype.clearDone = function() {
        var self = this;
        var tasks = this.taskList.querySelectorAll('.done');
        [].forEach.call(tasks, function(element) {
            console.log(element);
            self.removeTask(element.dataset.id);
        });
    }

    function Controller(model) {
        this.model = model;
        this.view = this.model.view;
        var self = this;

        this.view.showMenu.addEventListener('click', function() {
            this.classList.toggle('open');
            self.view.filters.classList.toggle('shown');
        })

        //Task list
        this.view.taskList.addEventListener('click', function(e) {
            var closestTarget = e.target.closest('article');
            if (!closestTarget) {
                return;
            }
            if (e.target.tagName === 'BUTTON') {
                self.model.removeTask(closestTarget.dataset.id);
                return;
            }
            self.model.toggleTask(closestTarget.dataset.id);
        })

        //New task form
        this.view.form.addEventListener('submit', function(e) {
            e.preventDefault();
            var text = self.view.formText.value;
            var deadline = self.view.formDate.value;
            if (text) {
                self.model.addTask(text, deadline);
                self.view.formText.value = '';
            }
        })

        //Filters
        this.view.filters.addEventListener('click', function(e) {

            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {

                if (e.target.tagName === 'BUTTON') {
                    e.preventDefault();
                }

                closestTarget = e.target.closest('input') || e.target.closest('button');
                switch (closestTarget.id) {
                    case 'show-all':
                        self.model.filterList('done', 'all');
                        break;
                    case 'show-done':
                        self.model.filterList('done', 'done');
                        break;
                    case 'show-undone':
                        self.model.filterList('done', 'undone');
                        break;
                    case 'sort-date-first':
                        self.model.sort('dateFirst');
                        break;
                    case 'sort-date-last':
                        self.model.sort('dateLast');
                        break;
                    case 'sort-urgency':
                        self.model.sort('urgency');
                        break;
                    case 'deadline-all':
                        self.model.filterList('deadline', 'All');
                        break;
                    case 'deadline-day':
                        self.model.filterList('deadline', 'Day');
                        break;
                    case 'deadline-week':
                        self.model.filterList('deadline', 'Week');
                        break;
                    case 'clear-all':
                        self.model.clearAll();
                        break;
                    case 'clear-checked':
                        self.model.clearDone();
                        break;
                    default:
                        break;
                }
            } else {
                return;
            }
        })

    }

    var view = new View();
    var model = new List(view);
    var controller = new Controller(model);

})();